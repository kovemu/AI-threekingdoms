// A Windows Job closes every managed inference process even if the app crashes.
use windows_sys::Win32::{Foundation::{CloseHandle,HANDLE},System::{JobObjects::*,Threading::*}};
pub struct Job(HANDLE);
unsafe impl Send for Job {}
impl Job {
    pub fn attach(pid:u32)->Result<Self,String> {
        unsafe {
            let job=CreateJobObjectW(std::ptr::null(),std::ptr::null());
            if job.is_null(){return Err(std::io::Error::last_os_error().to_string());}
            let result=Self(job);
            let mut info:JOBOBJECT_EXTENDED_LIMIT_INFORMATION=std::mem::zeroed();
            info.BasicLimitInformation.LimitFlags=JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if SetInformationJobObject(job,JobObjectExtendedLimitInformation,&info as *const _ as *const _,std::mem::size_of_val(&info) as u32)==0{return Err(std::io::Error::last_os_error().to_string());}
            let process=OpenProcess(PROCESS_SET_QUOTA|PROCESS_TERMINATE,0,pid);
            if process.is_null(){return Err(std::io::Error::last_os_error().to_string());}
            let ok=AssignProcessToJobObject(job,process);let err=std::io::Error::last_os_error();CloseHandle(process);
            if ok==0{return Err(err.to_string());}Ok(result)
        }
    }
}
impl Drop for Job {fn drop(&mut self){unsafe{CloseHandle(self.0);}}}
