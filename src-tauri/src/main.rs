#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{io::{BufRead, BufReader}, process::{Child, Command, Stdio}, sync::Mutex};
use tauri::Manager;
#[derive(Clone, serde::Serialize, serde::Deserialize)]
struct Connection { url: String, token: String }
struct Runtime { child: Mutex<Child>, connection: Connection }
#[tauri::command]
fn connection(state: tauri::State<Runtime>) -> Connection { state.connection.clone() }
fn main() {
 let app = tauri::Builder::default().setup(|app| {
  let base = app.path().resource_dir()?.join("app");
  let data = app.path().app_data_dir()?;
  std::fs::create_dir_all(&data)?;
  let mut child = Command::new(base.join("runtime/node"))
   .arg(base.join("server/main.mjs"))
   .current_dir(&base).env_clear()
   .env("HOME",std::env::var("HOME").unwrap_or_default())
   .env("PATH","/usr/bin:/bin")
   .env("LEX_DATA_DIR",data)
   .env("LEX_DESKTOP","1")
   .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn()?;
  let stdout=child.stdout.take().ok_or("No se pudo conectar con el servicio local")?;
  let (tx,rx)=std::sync::mpsc::channel();
  std::thread::spawn(move || { let mut line=String::new(); let result=BufReader::new(stdout).read_line(&mut line).map(|_|line);let _=tx.send(result); });
  let result=rx.recv_timeout(std::time::Duration::from_secs(30));
  let conn=match result {
   Ok(Ok(line))=>serde_json::from_str::<Connection>(&line),
   _=>{let _=child.kill();return Err("El servicio local no respondió al iniciar".into());}
  };
  match conn {Ok(connection)=>{app.manage(Runtime{child:Mutex::new(child),connection});},Err(e)=>{let _=child.kill();return Err(e.into());}}
  Ok(())
 }).invoke_handler(tauri::generate_handler![connection]).build(tauri::generate_context!()).expect("No se pudo abrir Rejon.AI");
 app.run(|handle,event|{if let tauri::RunEvent::Exit=event {
  if let Some(state)=handle.try_state::<Runtime>() {if let Ok(mut child)=state.child.lock(){
   // Closing stdin triggers graceful shutdown of Node and its owned inference process.
   child.stdin.take();
   for _ in 0..40 {if child.try_wait().ok().flatten().is_some(){return;}std::thread::sleep(std::time::Duration::from_millis(100));}
   let _=child.kill();let _=child.wait();
  }}
 }});
}
