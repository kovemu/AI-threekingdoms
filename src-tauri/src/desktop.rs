use crate::{db,runtime::{ModelManager,CompletionRequest},models::Status};
use serde_json::Value;
use std::path::PathBuf;
use tauri::{Manager,State};

struct AppState {db:PathBuf,ai:ModelManager}
#[tauri::command]
fn load_game(state:State<'_,AppState>,initial:Value)->Result<Value,String> {
    if initial.to_string().len()>1_000_000{return Err("초기 시나리오 크기 초과".into());}
    db::load(&state.db,&initial)
}
#[tauri::command]
fn save_turn(state:State<'_,AppState>,expected_version:i64,turn:Value)->Result<(),String> {db::commit(&state.db,expected_version,&turn)}
#[tauri::command]
fn model_status(state:State<'_,AppState>)->Status {state.ai.status()}
#[tauri::command]
async fn prepare_model(state:State<'_,AppState>)->Result<Status,String> {state.ai.prepare().await}
#[tauri::command]
async fn complete_text(state:State<'_,AppState>,request:CompletionRequest)->Result<String,String> {state.ai.complete(request).await}

pub fn run() {
    let app=tauri::Builder::default()
        .setup(|app| {
            let root=app.path().app_data_dir()?;std::fs::create_dir_all(&root)?;
            app.manage(AppState{db:root.join("game.sqlite"),ai:ModelManager::new(root)});Ok(())
        })
        .invoke_handler(tauri::generate_handler![load_game,save_turn,model_status,prepare_model,complete_text])
        .build(tauri::generate_context!()).expect("앱 시작 실패");
    app.run(|handle,event|if matches!(event,tauri::RunEvent::ExitRequested{..}|tauri::RunEvent::Exit){handle.state::<AppState>().ai.stop_now();});
}
