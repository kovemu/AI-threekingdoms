use crate::models::{self, Progress, Status, ModelProfile, Hardware};
use serde::{Serialize,Deserialize};
use serde_json::{json,Value};
use std::{path::{Path,PathBuf},process::Stdio,sync::{Arc,Mutex},time::Duration};
use tokio::process::{Child,Command};

#[derive(Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct CompletionRequest {pub messages:Vec<Message>,pub max_tokens:u32,pub json_schema:Option<Value>}
#[derive(Serialize,Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Message {pub role:String,pub content:String}
impl CompletionRequest {
    pub fn validate(&self)->Result<(),String> {
        if self.messages.is_empty()||self.messages.len()>4||self.max_tokens==0||self.max_tokens>900||self.messages.iter().any(|m|!matches!(m.role.as_str(),"system"|"user"))||self.messages.iter().map(|m|m.content.len()).sum::<usize>()>40000 {return Err("추론 요청 크기 또는 형식 오류".into());}Ok(())
    }
}
struct Running {child:Child,base:String,key:String,client:reqwest::Client,
    #[cfg(windows)] _job:crate::windows_job::Job,
}
impl Running {
    async fn launch(exe:&Path,model:&Path,profile:&ModelProfile,gpu:bool,log:&Path)->Result<Self,String> {
        let port=std::net::TcpListener::bind("127.0.0.1:0").map_err(|e|e.to_string())?.local_addr().map_err(|e|e.to_string())?.port();
        let key=uuid::Uuid::new_v4().to_string();
        let out=std::fs::OpenOptions::new().create(true).append(true).open(log).map_err(|e|e.to_string())?;
        let mut command=Command::new(exe);
        command.args(["--model"]).arg(model).args(["--host","127.0.0.1","--port",&port.to_string(),"--api-key",&key,"--ctx-size",&profile.context.to_string(),"--parallel","1","--n-gpu-layers",&if gpu {profile.gpu_layers.to_string()}else{"0".into()},"--batch-size","128","--ubatch-size","128","--jinja","--chat-template-kwargs","{\"enable_thinking\":false}"])
            .current_dir(exe.parent().ok_or("실행 경로 오류")?).stdin(Stdio::null()).stdout(Stdio::from(out.try_clone().map_err(|e|e.to_string())?)).stderr(Stdio::from(out)).kill_on_drop(true);
        #[cfg(windows)] command.creation_flags(0x08000000);
        let child=command.spawn().map_err(|e|format!("로컬 런타임 시작 실패: {e}"))?;
        #[cfg(windows)] let job=crate::windows_job::Job::attach(child.id().ok_or("프로세스 ID 오류")?)?;
        let client=reqwest::Client::builder().no_proxy().connect_timeout(Duration::from_secs(2)).timeout(Duration::from_secs(180)).redirect(reqwest::redirect::Policy::none()).build().map_err(|e|e.to_string())?;
        let mut running=Self{child,base:format!("http://127.0.0.1:{port}"),key,client,#[cfg(windows)] _job:job};
        let started=std::time::Instant::now();
        while started.elapsed()<Duration::from_secs(180) {
            if let Some(status)=running.child.try_wait().map_err(|e|e.to_string())? {return Err(format!("모델 로딩 실패 ({status}). runtime.log를 확인해 주세요."));}
            if let Ok(response)=running.client.get(format!("{}/health",running.base)).bearer_auth(&running.key).timeout(Duration::from_secs(2)).send().await {if response.status().is_success(){return Ok(running);}}
            tokio::time::sleep(Duration::from_millis(400)).await;
        }
        let _=running.child.kill().await;Err("모델 로딩 시간 초과".into())
    }
    async fn complete(&mut self,request:CompletionRequest)->Result<String,String> {
        request.validate()?;
        if self.child.try_wait().map_err(|e|e.to_string())?.is_some(){return Err("로컬 AI가 종료되었습니다. 다시 준비해 주세요.".into());}
        let mut body=json!({"messages":request.messages,"max_tokens":request.max_tokens,"temperature":if request.json_schema.is_some(){0.1}else{0.65},"stream":false,"cache_prompt":true,"chat_template_kwargs":{"enable_thinking":false}});
        if let Some(schema)=request.json_schema {body["response_format"]=json!({"type":"json_schema","json_schema":{"name":"turn_proposal","strict":true,"schema":schema}});}
        let response=self.client.post(format!("{}/v1/chat/completions",self.base)).bearer_auth(&self.key).json(&body).send().await.map_err(|e|format!("로컬 AI 응답 실패: {e}"))?.error_for_status().map_err(|e|format!("로컬 AI 요청 실패: {e}"))?;
        let value:Value=response.json().await.map_err(|e|e.to_string())?;
        if value["choices"][0]["finish_reason"]=="length" {return Err("AI 응답 길이 제한에 도달했습니다. 행동을 나누어 입력해 주세요.".into());}
        let content=value["choices"][0]["message"]["content"].as_str().filter(|s|!s.trim().is_empty()).ok_or("AI 응답이 비어 있습니다.")?;
        if content.len()>48000{return Err("AI 응답 크기 초과".into());}Ok(content.to_string())
    }
}
#[derive(Clone)]
pub struct ModelManager {inner:Arc<tokio::sync::Mutex<Option<Running>>>,status:Arc<Mutex<Status>>,root:PathBuf}
impl ModelManager {
    pub fn new(root:PathBuf)->Self {Self{inner:Arc::new(tokio::sync::Mutex::new(None)),status:Arc::new(Mutex::new(Status::new("checking","로컬 AI 준비 대기"))),root}}
    pub fn status(&self)->Status {self.status.lock().unwrap_or_else(|p|p.into_inner()).clone()}
    fn progress(&self)->Progress {let status=self.status.clone();Arc::new(move|s|{*status.lock().unwrap_or_else(|p|p.into_inner())=s;})}
    pub async fn prepare(&self)->Result<Status,String> {
        let mut running=self.inner.lock().await;
        if let Some(r)=running.as_mut() {if r.child.try_wait().map_err(|e|e.to_string())?.is_none(){return Ok(self.status());}}
        *running=None;
        let progress=self.progress();
        let result=self.prepare_inner(&progress).await;
        match result {
            Ok((r,model,hardware,gpu))=>{*running=Some(r);let mut s=Status::new("ready",if gpu {"로컬 AI 준비 완료"}else{"CPU 모드 준비 완료 · 응답에 시간이 걸릴 수 있습니다"});s.model_id=Some(model);s.hardware=Some(hardware);progress(s.clone());Ok(s)},
            Err(e)=>{progress(Status::new("error",&e));Err(e)}
        }
    }
    async fn prepare_inner(&self,progress:&Progress)->Result<(Running,String,Hardware,bool),String> {
        if !cfg!(all(target_os="windows",target_arch="x86_64")){return Err("현재 로컬 AI 배포 대상은 Windows x64입니다.".into());}
        progress(Status::new("checking","GPU와 메모리를 확인합니다"));
        let hardware=models::detect_hardware().await;
        if hardware.ram_gb<7.0{return Err("최소 8GB 메모리가 필요합니다. 권장 최소 사양은 16GB입니다.".into());}
        let manifest=models::manifest()?;
        let first=models::select_profile(&hardware);
        let use_gpu=hardware.free_vram_gb>=3.7;
        let mut attempts=vec![(first,use_gpu)];
        if first!="low" {attempts.push(("low",use_gpu));}
        if use_gpu {attempts.push(("low",false));}
        let mut errors=Vec::new();
        for (profile_id,gpu) in attempts {
            let profile=manifest.profiles.iter().find(|p|p.id==profile_id).ok_or("모델 프로필 없음")?;
            let artifact=manifest.runtimes.iter().find(|r|r.id==if gpu {"windows-vulkan"}else{"windows-cpu"}).ok_or("런타임 프로필 없음")?;
            // Download errors are retryable; don't hide a bad network by downloading another multi-GB file.
            let model=models::acquire(&self.root.join("models"),&profile.filename,&profile.url,&profile.sha256,profile.bytes,progress).await?;
            let archive=models::acquire(&self.root.join("runtime"),&artifact.filename,&artifact.url,&artifact.sha256,artifact.bytes,progress).await?;
            let unpack=self.root.join("runtime").join(format!("{}-{}",artifact.id,artifact.version));let executable=artifact.executable.clone();
            let exe=tokio::task::spawn_blocking(move||models::extract_runtime(&archive,&unpack,&executable)).await.map_err(|e|e.to_string())??;
            progress(Status::new("starting",&format!("{} 로딩 중{}",profile.model_id,if gpu{""}else{" (CPU)"})));
            match Running::launch(&exe,&model,profile,gpu,&self.root.join("runtime.log")).await {
                Ok(r)=>return Ok((r,profile.model_id.clone(),hardware,gpu)),
                Err(e)=>{errors.push(e);progress(Status::new("starting","더 작은 모델 또는 CPU 모드로 자동 재시도합니다"));}
            }
        }
        Err(format!("로컬 AI 준비에 실패했습니다: {}",errors.join(" / ")))
    }
    pub async fn complete(&self,request:CompletionRequest)->Result<String,String> {
        let mut guard=self.inner.lock().await;
        let result=match guard.as_mut(){Some(r)=>r.complete(request).await,None=>Err("로컬 AI 준비가 필요합니다.".into())};
        if let Err(e)=&result {
            if let Some(mut r)=guard.take(){let _=r.child.kill().await;}
            (self.progress())(Status::new("error",e));
        }
        result
    }
    pub fn stop_now(&self) {if let Ok(mut guard)=self.inner.try_lock(){if let Some(mut r)=guard.take(){let _=r.child.start_kill();}}}
}
#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(windows)]
    #[tokio::test]
    #[ignore = "Downloads ~2.5GB and runs real local inference; Windows CI only"]
    async fn managed_runtime_smoke() {
        let dir=tempfile::tempdir().unwrap();
        let manager=ModelManager::new(dir.path().to_path_buf());
        let status=manager.prepare().await.expect("automatic prepare");
        assert_eq!(status.phase,"ready");
        let result=manager.complete(CompletionRequest{messages:vec![Message{role:"user".into(),content:"Reply with one short Korean greeting. /no_think".into()}],max_tokens:64,json_schema:None}).await.expect("real local inference");
        assert!(!result.trim().is_empty());println!("Local model: {:?}; response: {}",status.model_id,result);
        manager.stop_now();
        assert_eq!(manager.prepare().await.expect("verified restart").phase,"ready");
        manager.stop_now();
    }
    #[test]
    fn rejects_oversized_and_untrusted_completion_roles() {
        let bad=CompletionRequest{messages:vec![Message{role:"assistant".into(),content:"x".into()}],max_tokens:32,json_schema:None};assert!(bad.validate().is_err());
        let big=CompletionRequest{messages:vec![Message{role:"user".into(),content:"x".repeat(40001)}],max_tokens:32,json_schema:None};assert!(big.validate().is_err());
        let valid=CompletionRequest{messages:vec![Message{role:"user".into(),content:"안녕".into()}],max_tokens:384,json_schema:None};assert!(valid.validate().is_ok());
    }
}
