use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{io::Read, path::{Path,PathBuf}, sync::Arc, time::Duration};
use futures_util::StreamExt;
use tokio::io::AsyncWriteExt;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Hardware { pub ram_gb:f64, pub vram_gb:f64, pub free_vram_gb:f64 }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Status {pub phase:String,pub message:String,pub downloaded:u64,pub total:u64,pub model_id:Option<String>,pub hardware:Option<Hardware>}
impl Status {pub fn new(phase:&str,message:&str)->Self {Self{phase:phase.into(),message:message.into(),downloaded:0,total:0,model_id:None,hardware:None}}}
pub type Progress=Arc<dyn Fn(Status)+Send+Sync>;
#[derive(Clone,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct ModelProfile {pub id:String,pub model_id:String,pub filename:String,pub url:String,pub sha256:String,pub bytes:u64,pub context:u32,pub gpu_layers:u32}
#[derive(Clone,Deserialize)]
pub struct RuntimeArtifact {pub id:String,pub version:String,pub filename:String,pub url:String,pub sha256:String,pub bytes:u64,pub executable:String}
#[derive(Deserialize)]
pub struct Manifest {pub profiles:Vec<ModelProfile>,pub runtimes:Vec<RuntimeArtifact>}
pub fn manifest()->Result<Manifest,String> {serde_json::from_str(include_str!("../../src/ai/model-manifest.json")).map_err(|e|e.to_string())}
pub fn select_profile(h:&Hardware)->&'static str {
    // OS reports slightly less than installed RAM. Reserve GPU space for desktop/KV/cache.
    if h.ram_gb>=15.0&&h.vram_gb>=7.5&&h.free_vram_gb>=6.2 {"default"}else{"low"}
}
pub async fn detect_hardware()->Hardware {
    let mut system=sysinfo::System::new();system.refresh_memory();
    let mut h=Hardware{ram_gb:system.total_memory() as f64/1073741824.0,vram_gb:0.0,free_vram_gb:0.0};
    let mut cmd=tokio::process::Command::new("nvidia-smi");
    cmd.args(["--query-gpu=memory.total,memory.free","--format=csv,noheader,nounits"]).kill_on_drop(true);
    #[cfg(windows)] cmd.creation_flags(0x08000000);
    if let Ok(Ok(out))=tokio::time::timeout(Duration::from_secs(4),cmd.output()).await {
        // Conservative single-GPU target. Unrecognized adapters use CPU fallback.
        if let Some(line)=String::from_utf8_lossy(&out.stdout).lines().next() {
            let values:Vec<f64>=line.split(',').filter_map(|v|v.trim().parse::<f64>().ok()).collect();
            if values.len()==2 {h.vram_gb=values[0]/1024.0;h.free_vram_gb=values[1]/1024.0;}
        }
    }
    h
}
pub fn verify_file(path:&Path,expected:&str,bytes:u64)->Result<bool,String> {
    if !path.is_file() {return Ok(false);}
    let mut file=std::fs::File::open(path).map_err(|e|e.to_string())?;
    if file.metadata().map_err(|e|e.to_string())?.len()!=bytes {return Ok(false);}
    let mut hash=Sha256::new();let mut buffer=vec![0u8;1024*1024];
    loop {let n=file.read(&mut buffer).map_err(|e|e.to_string())?;if n==0 {break;}hash.update(&buffer[..n]);}
    Ok(format!("{:x}",hash.finalize())==expected)
}
async fn verified(path:&Path,hash:&str,bytes:u64)->Result<bool,String> {
    let p=path.to_path_buf();let h=hash.to_string();
    tokio::task::spawn_blocking(move||verify_file(&p,&h,bytes)).await.map_err(|e|e.to_string())?
}
pub async fn acquire(dir:&Path,filename:&str,url:&str,hash:&str,bytes:u64,progress:&Progress)->Result<PathBuf,String> {
    if !url.starts_with("https://")||hash.len()!=64||!hash.bytes().all(|b|b.is_ascii_hexdigit())||filename.contains(['/', '\\']) {return Err("다운로드 manifest 오류".into());}
    tokio::fs::create_dir_all(dir).await.map_err(|e|e.to_string())?;
    let dest=dir.join(filename);
    progress(Status::new("verifying",&format!("파일 확인: {filename}")));
    if verified(&dest,hash,bytes).await? {return Ok(dest);}
    if dest.exists() {tokio::fs::remove_file(&dest).await.map_err(|e|e.to_string())?;}
    let part=dir.join(format!("{filename}.part"));
    if verified(&part,hash,bytes).await? {tokio::fs::rename(&part,&dest).await.map_err(|e|e.to_string())?;return Ok(dest);}
    let mut offset=tokio::fs::metadata(&part).await.map(|m|m.len()).unwrap_or(0);
    if offset>=bytes {tokio::fs::remove_file(&part).await.map_err(|e|e.to_string())?;offset=0;}
    let client=reqwest::Client::builder().connect_timeout(Duration::from_secs(20)).read_timeout(Duration::from_secs(90)).https_only(true).build().map_err(|e|e.to_string())?;
    let mut request=client.get(url);
    if offset>0 {request=request.header(reqwest::header::RANGE,format!("bytes={offset}-"));}
    let response=request.send().await.map_err(|e|format!("다운로드 연결 실패: {e}"))?.error_for_status().map_err(|e|e.to_string())?;
    if response.status()==reqwest::StatusCode::PARTIAL_CONTENT {
        let expected=format!("bytes {offset}-");
        if !response.headers().get(reqwest::header::CONTENT_RANGE).and_then(|h|h.to_str().ok()).is_some_and(|h|h.starts_with(&expected)) {return Err("서버의 이어받기 범위 오류".into());}
    } else {offset=0;}
    let mut file=tokio::fs::OpenOptions::new().create(true).write(true).append(offset>0).truncate(offset==0).open(&part).await.map_err(|e|e.to_string())?;
    let mut stream=response.bytes_stream();let mut downloaded=offset;let mut last=std::time::Instant::now();
    while let Some(chunk)=stream.next().await {
        let chunk=chunk.map_err(|e|format!("다운로드 중단; 재시도하면 이어받습니다: {e}"))?;
        downloaded+=chunk.len() as u64;
        if downloaded>bytes {drop(file);let _=tokio::fs::remove_file(&part).await;return Err("예상 파일 크기 초과".into());}
        file.write_all(&chunk).await.map_err(|e|format!("저장 공간을 확인해 주세요: {e}"))?;
        if last.elapsed()>=Duration::from_millis(200) {let mut s=Status::new("downloading",&format!("자동 다운로드: {filename}"));s.downloaded=downloaded;s.total=bytes;progress(s);last=std::time::Instant::now();}
    }
    file.sync_all().await.map_err(|e|e.to_string())?;drop(file);
    progress(Status::new("verifying",&format!("SHA-256 검사: {filename}")));
    if !verified(&part,hash,bytes).await? {let _=tokio::fs::remove_file(&part).await;return Err("파일 검증 실패. 다시 시도해 주세요.".into());}
    tokio::fs::rename(&part,&dest).await.map_err(|e|e.to_string())?;Ok(dest)
}
pub fn extract_runtime(archive:&Path,dir:&Path,executable:&str)->Result<PathBuf,String> {
    let file=std::fs::File::open(archive).map_err(|e|e.to_string())?;
    let mut zip=zip::ZipArchive::new(file).map_err(|e|e.to_string())?;
    let mut total=0u64;let mut found=None;
    for i in 0..zip.len() {
        let mut entry=zip.by_index(i).map_err(|e|e.to_string())?;
        let relative=entry.enclosed_name().ok_or("런타임 압축 경로 오류")?;
        if entry.unix_mode().is_some_and(|m|m&0o170000==0o120000) {return Err("런타임 심볼릭 링크 거부".into());}
        total+=entry.size();if total>500_000_000 {return Err("런타임 압축 크기 초과".into());}
        let path=dir.join(relative);
        if entry.is_dir() {std::fs::create_dir_all(&path).map_err(|e|e.to_string())?;continue;}
        if let Some(parent)=path.parent() {std::fs::create_dir_all(parent).map_err(|e|e.to_string())?;}
        let mut output=std::fs::File::create(&path).map_err(|e|e.to_string())?;
        std::io::copy(&mut entry,&mut output).map_err(|e|e.to_string())?;
        if path.file_name().is_some_and(|n|n==executable) {found=Some(path);}
    }
    found.ok_or("런타임 실행 파일이 없습니다.".into())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn eight_gb_selects_default_and_low_memory_falls_back() {
        assert_eq!(select_profile(&Hardware{ram_gb:16.0,vram_gb:8.0,free_vram_gb:7.0}),"default");
        assert_eq!(select_profile(&Hardware{ram_gb:16.0,vram_gb:8.0,free_vram_gb:2.0}),"low");
        assert_eq!(select_profile(&Hardware{ram_gb:8.0,vram_gb:0.0,free_vram_gb:0.0}),"low");
    }
    #[test]
    fn verifies_checksum_and_size_not_just_existence() {
        let d=tempfile::tempdir().unwrap();let p=d.path().join("model.gguf");std::fs::write(&p,b"abc").unwrap();
        let hash="ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
        assert!(verify_file(&p,hash,3).unwrap());
        assert!(!verify_file(&p,hash,4).unwrap());
        std::fs::write(&p,b"bad").unwrap();assert!(!verify_file(&p,hash,3).unwrap());
    }
}
