// =====================================
// WESAL - تطبيق وصال
// نظام اكتشاف اليد وجمع بيانات لغة الإشارة
// =====================================


// =====================================
// المتغيرات العامة
// =====================================

let cameraStream = null;
let handsModel = null;
let cameraAnimationId = null;

const DATASET_KEY = "wesal_sign_dataset";

const FRAMES_PER_SAMPLE = 30;
const FRAME_INTERVAL = 100;

let isRecording = false;
let recordingFrames = [];
let recordingLabel = "";
let lastCaptureTime = 0;


// =====================================
// إدارة بيانات الإشارات
// =====================================

function getDataset() {
    try {
        return JSON.parse(
            localStorage.getItem(DATASET_KEY) || "[]"
        );
    } catch (error) {
        console.error("Dataset Error:", error);
        return [];
    }
}


function saveDataset(dataset) {
    try {
        localStorage.setItem(
            DATASET_KEY,
            JSON.stringify(dataset)
        );

        return true;

    } catch (error) {
        console.error("Save Error:", error);

        alert("مساحة التخزين غير كافية. صدّري بياناتك أولًا.");

        return false;
    }
}


function updateDatasetCount() {

    const countElement =
        document.getElementById("datasetCount");

    if (!countElement) return;

    const dataset = getDataset();

    countElement.textContent =
        "عدد العينات المحفوظة: " + dataset.length;
}


// =====================================
// تجهيز بيانات اليد
// =====================================

function normalizeLandmarks(landmarks) {

    if (!landmarks || landmarks.length !== 21) {
        return null;
    }

    const wrist = landmarks[0];

    let maxDistance = 0;

    landmarks.forEach(point => {

        const dx = point.x - wrist.x;
        const dy = point.y - wrist.y;
        const dz = point.z - wrist.z;

        const distance = Math.sqrt(
            dx * dx + dy * dy + dz * dz
        );

        maxDistance = Math.max(
            maxDistance,
            distance
        );
    });

    if (maxDistance === 0) return null;

    return landmarks.map(point => ({

        x: Number(
            ((point.x - wrist.x) / maxDistance).toFixed(5)
        ),

        y: Number(
            ((point.y - wrist.y) / maxDistance).toFixed(5)
        ),

        z: Number(
            ((point.z - wrist.z) / maxDistance).toFixed(5)
        )

    }));
}


// =====================================
// بدء تسجيل إشارة جديدة
// =====================================

function startSignRecording() {

    const input =
        document.getElementById("signWord");

    const status =
        document.getElementById("recordingStatus");

    if (!cameraStream || !handsModel) {

        status.textContent =
            "شغّلي الكاميرا أولًا.";

        return;
    }

    if (isRecording) return;

    const word = input.value.trim();

    if (!word) {

        status.textContent =
            "اكتبي اسم الإشارة أولًا.";

        return;
    }

    recordingLabel = word;

    recordingFrames = [];

    lastCaptureTime = 0;

    isRecording = true;

    status.textContent =
        "🔴 جارٍ تسجيل إشارة: " + word;

    document.getElementById(
        "recordSign"
    ).disabled = true;

    document.getElementById(
        "stopRecording"
    ).disabled = false;
}


// =====================================
// التقاط بيانات الإشارة
// =====================================

function captureSignFrame(results) {

    if (!isRecording) return;

    const now = Date.now();

    if (now - lastCaptureTime < FRAME_INTERVAL) {
        return;
    }

    lastCaptureTime = now;

    const hands =
        results.multiHandLandmarks || [];

    // نستخدم اليد الأولى في هذه المرحلة
    if (hands.length === 0) return;

    const normalized =
        normalizeLandmarks(hands[0]);

    if (!normalized) return;

    recordingFrames.push(normalized);

    const status =
        document.getElementById("recordingStatus");

    if (status) {

        status.textContent =
            "🔴 تسجيل " + recordingLabel +
            " : " + recordingFrames.length +
            " / " + FRAMES_PER_SAMPLE;
    }

    if (
        recordingFrames.length >= FRAMES_PER_SAMPLE
    ) {

        finishSignRecording();
    }
}


// =====================================
// إنهاء وحفظ تسجيل الإشارة
// =====================================

function finishSignRecording() {

    if (!isRecording) return;

    isRecording = false;

    const status =
        document.getElementById("recordingStatus");

    const recordButton =
        document.getElementById("recordSign");

    const stopButton =
        document.getElementById("stopRecording");

    if (recordingFrames.length >= 10) {

        const dataset = getDataset();

        const sample = {

            label: recordingLabel,

            frames: recordingFrames,

            frameCount: recordingFrames.length,

            createdAt: new Date().toISOString()

        };

        dataset.push(sample);

        const saved = saveDataset(dataset);

        if (saved) {

            if (status) {

                status.textContent =
                    "✅ تم حفظ عينة إشارة: " +
                    recordingLabel;
            }

            updateDatasetCount();

        } else if (status) {

            status.textContent =
                "تعذر حفظ العينة. صدّري البيانات القديمة.";
        }

    } else {

        if (status) {

            status.textContent =
                "العينة قصيرة جدًا. سجّلي 10 إطارات على الأقل.";
        }
    }

    recordingFrames = [];

    recordingLabel = "";

    if (recordButton) {
        recordButton.disabled = false;
    }

    if (stopButton) {
        stopButton.disabled = true;
    }
}


// =====================================
// تصدير بيانات التدريب
// =====================================

function exportDataset() {

    const dataset = getDataset();

    if (dataset.length === 0) {

        alert("لا توجد بيانات محفوظة حتى الآن.");

        return;
    }

    const data = {

        project: "WESAL",

        description: "Arabic Sign Language Dataset",

        totalSamples: dataset.length,

        exportedAt: new Date().toISOString(),

        samples: dataset

    };

    const blob = new Blob(

        [JSON.stringify(data, null, 2)],

        { type: "application/json" }

    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = "wesal-sign-dataset.json";

    link.click();

    URL.revokeObjectURL(url);
}


// =====================================
// حذف بيانات التدريب
// =====================================

function clearDataset() {

    const dataset = getDataset();

    if (dataset.length === 0) {

        alert("لا توجد بيانات لحذفها.");

        return;
    }

    const confirmed = confirm(
        "هل أنت متأكدة من حذف جميع بيانات الإشارات؟"
    );

    if (!confirmed) return;

    localStorage.removeItem(DATASET_KEY);

    updateDatasetCount();

    const status =
        document.getElementById("recordingStatus");

    if (status) {

        status.textContent =
            "تم حذف بيانات التدريب.";
    }
}


// =====================================
// فتح الخدمات
// =====================================

function openService(service) {
// فتح محرك SLI داخل وصال
    if (service === "sign") {

        stopCamera();
        stopWesalSignAI();

        const oldPanel = document.getElementById("service-panel");
        if (oldPanel) oldPanel.remove();

        const oldFrame = document.getElementById("sli-panel");
        if (oldFrame) oldFrame.remove();

        const panel = document.createElement("section");
        panel.id = "sli-panel";

        panel.style.cssText = `
            background: white;
            padding: 20px;
            margin: 30px auto;
            max-width: 1100px;
            border-radius: 18px;
            text-align: center;
            box-shadow: 0 5px 25px rgba(0,0,0,0.08);
        `;

        panel.innerHTML = `
            <h2 style="color:#176B68">
                🤟 ترجمة لغة الإشارة - وصال
            </h2>

            <p>استخدمي الكاميرا لبدء ترجمة الإشارات.</p>

            <iframe
                src="/sli-engine/"
                title="محرك SLI"
                allow="camera; microphone"
                style="
                    width:100%;
                    height:750px;
                    border:0;
                    border-radius:12px;
                    background:white;
                ">
            </iframe>

            <button id="close-sli" class="main-button">
                العودة إلى وصال
            </button>
        `;

        const footer = document.querySelector("footer");

        if (footer) {
            footer.before(panel);
        } else {
            document.body.appendChild(panel);
        }

        panel.scrollIntoView({ behavior: "smooth" });

        document.getElementById("close-sli").onclick = () => {
            panel.remove();
            document.getElementById("services")
                ?.scrollIntoView({ behavior: "smooth" });
        };

        return;
    }
    const services = {

        sign: {
            title: "🤟 ترجمة لغة الإشارة",
            description: "شغّلي الكاميرا وابدئي بعرض إشارات اليد."
        },

        speech: {
            title: "🎙️ تحويل الكلام إلى نص",
            description: "اضغط على زر الميكروفون وابدأ بالتحدث."
        },

        academy: {
            title: "📚 أكاديمية وصال",
            description: "تعلم لغة الإشارة من خلال دروس تفاعلية."
        },

        assistant: {
            title: "🤖 المساعد الذكي",
            description: "سيكون وصال مساعدك في المحادثات اليومية."
        }
    };

    const selected = services[service];

    if (!selected) return;

    const oldPanel =
        document.getElementById("service-panel");

    if (oldPanel) {

        stopCamera();

        oldPanel.remove();
    }

    const panel = document.createElement("section");

    panel.id = "service-panel";

    panel.style.cssText = `
        background: white;
        padding: 35px;
        margin: 35px auto;
        max-width: 700px;
        border-radius: 18px;
        text-align: center;
        box-shadow: 0 5px 25px rgba(0,0,0,0.08);
    `;

    panel.innerHTML = `
        <h2 style="color:#176B68">
            ${selected.title}
        </h2>

        <p style="margin:15px 0">
            ${selected.description}
        </p>

        <div id="result"
            style="margin:20px;color:#176B68">
        </div>

        ${
            service === "speech"
            ? `
                <button id="mic-button" class="main-button">
                    🎙️ ابدأ التحدث
                </button>
            `
            : ''
        }

        ${
            service === "sign"
            ? `
                <div style="
                    position:relative;
                    width:100%;
                    max-width:450px;
                    margin:auto;
                ">

                    <video
                        id="cameraPreview"
                        autoplay
                        playsinline
                        muted
                        style="
                            width:100%;
                            display:block;
                            border-radius:15px;
                            background:#eee;
                        ">
                    </video>

                    <canvas
                        id="handCanvas"
                        style="
                            position:absolute;
                            top:0;
                            left:0;
                            width:100%;
                            height:100%;
                            pointer-events:none;
                        ">
                    </canvas>

                </div>

                <br>

                <button id="startCamera" class="main-button">
                    📷 تشغيل الكاميرا
                </button>

                <button id="stopCamera" class="main-button">
                    ⏹️ إيقاف الكاميرا
                </button>

                <hr style="margin:25px 0">

                <h3 style="color:#176B68">
                    📚 جمع بيانات لغة الإشارة
                </h3>

                <p>
                    اكتبي الكلمة التي تمثل الإشارة
                    ثم سجّلي حركتها أمام الكاميرا.
                </p>

                <input
                    id="signWord"
                    type="text"
                    placeholder="مثال: مرحبًا، شكرًا، نعم..."
                    style="
                        width:100%;
                        max-width:350px;
                        padding:12px;
                        margin:15px auto;
                        border:1px solid #ccc;
                        border-radius:10px;
                        text-align:center;
                        display:block;
                    "
                >

                <button
                    id="recordSign"
                    class="main-button">
                    🔴 تسجيل الإشارة
                </button>

                <button
                    id="stopRecording"
                    class="main-button"
                    disabled>
                    ⏹️ إنهاء التسجيل
                </button>

                <p
                    id="recordingStatus"
                    style="color:#176B68;margin:15px">
                    جاهز لتسجيل إشارة جديدة.
                </p>

                <div style="
                    background:#f1f8f7;
                    padding:15px;
                    border-radius:12px;
                    margin-top:15px;
                ">

                    <h4 style="color:#176B68">
                        إحصائيات البيانات
                    </h4>

                    <p id="datasetCount">
                        عدد العينات المحفوظة: 0
                    </p>

                    <button
                        id="exportDataset"
                        class="main-button">
                        📥 تصدير بيانات التدريب
                    </button>

                    <button
                        id="clearDataset"
                        class="main-button"
                        style="margin-top:10px">
                        🗑️ حذف البيانات
                    </button>

                </div>

                <p style="
                    font-size:13px;
                    color:#777;
                    margin-top:15px;
                ">
                    كل عينة تتكون من 30 إطارًا تقريبًا.
                    يمكنك تسجيل عدة عينات للكلمة نفسها
                    وإضافة كلمات أخرى.
                </p>

                <p id="signResult"
                    style="color:#176B68;margin-top:20px">
                    بانتظار تشغيل الكاميرا...
                </p>
            `
            : ''
        }

        <br><br>

        <button id="close-button" class="main-button">
            إغلاق
        </button>
    `;

// =====================================
// مساعد وصال التفاعلي - نسخة تجريبية
// =====================================

if (service === "assistant") {
    const area = panel.querySelector("#result");

    const chat = document.createElement("div");
    chat.style.cssText = "background:#f1f8f7;padding:20px;border-radius:15px;text-align:right;direction:rtl;";

    const messages = document.createElement("div");
    messages.style.cssText = "min-height:100px;margin-bottom:15px;";

    const input = document.createElement("input");
    input.placeholder = "اكتب رسالتك هنا...";
    input.style.cssText = "width:90%;padding:12px;border:1px solid #ccc;border-radius:10px;";

    const send = document.createElement("button");
    send.textContent = "إرسال";
    send.className = "main-button";

    function addMessage(sender, message) {
        const p = document.createElement("p");
        p.textContent = sender + ": " + message;
        p.style.cssText = "padding:10px;background:white;border-radius:10px;margin:8px 0;";
        messages.appendChild(p);
    }

    function reply(message) {
        const text = message.trim().toLowerCase();

        if (text.includes("كيف حالك")) {
            return "أنا بخير، شكرًا لسؤالك!";
        }

        if (text.includes("سلام") || text.includes("مرحبا") ||
            text.includes("مرحبًا") || text.includes("هلا")) {
            return "أهلًا بك في وصال! كيف أساعدك؟";
        }

        if (text.includes("شكر")) {
            return "العفو! يسعدني مساعدتك.";
        }

        if (text.includes("اكاديم") || text.includes("أكاديم") ||
            text.includes("تعلم")) {
            return "يمكنك تعلم لغة الإشارة من خلال أكاديمية وصال.";
        }

        if (text.includes("اشار") || text.includes("إشار") ||
            text.includes("ترجم")) {
            return "يمكنك تجربة خدمة ترجمة لغة الإشارة باستخدام الكاميرا.";
        }

        if (text.includes("صوت") || text.includes("كلام")) {
            return "يمكنك استخدام خدمة تحويل الكلام إلى نص في وصال.";
        }

        if (text.includes("مساعدة") || text.includes("مساعده")) {
            return "يسعدني مساعدتك! يمكنك استخدام الترجمة أو تحويل الكلام إلى نص أو الأكاديمية.";
        }

        return "أنا مساعد وصال التجريبي. يمكنني الإجابة عن الأسئلة المتعلقة بخدمات التطبيق.";
    }

    function sendMessage() {
        const message = input.value.trim();
        if (!message) return;

        addMessage("أنت", message);
        addMessage("وصال", reply(message));

        input.value = "";
        input.focus();
    }

    send.onclick = sendMessage;

    input.addEventListener("keydown", function(event) {
        if (event.key === "Enter") {
            sendMessage();
        }
    });

    chat.append(messages, input, send);
    area.appendChild(chat);

    addMessage(
        "وصال",
        "مرحبًا! أنا مساعد وصال. اسألني عن خدمات التطبيق."
    );
}

    const footer = document.querySelector("footer");

    if (footer) {
        footer.before(panel);
    } else {
        document.body.appendChild(panel);
    }

    panel.scrollIntoView({
        behavior: "smooth"
    });

    document.getElementById("close-button").onclick = () => {

        stopCamera();

        panel.remove();
    };

    if (service === "speech") {
        setupSpeechRecognition();
    }

    if (service === "sign") {

        document.getElementById("startCamera").onclick =
            startCamera;

        document.getElementById("stopCamera").onclick =
            stopCamera;

        document.getElementById("recordSign").onclick =
            startSignRecording;

        document.getElementById("stopRecording").onclick =
            finishSignRecording;

        document.getElementById("exportDataset").onclick =
            exportDataset;

        document.getElementById("clearDataset").onclick =
            clearDataset;

        updateDatasetCount();
    }
}


// =====================================
// تحويل الكلام إلى نص
// Speech to Text
// =====================================

function setupSpeechRecognition() {

    const micButton =
        document.getElementById("mic-button");

    const result =
        document.getElementById("result");

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

        result.textContent =
            "المتصفح لا يدعم التعرف على الكلام. جربي Google Chrome.";

        return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "ar-SA";

    recognition.continuous = false;

    recognition.interimResults = false;

    micButton.onclick = () => {

        result.textContent =
            "🎧 وصال يستمع إليك الآن...";

        micButton.disabled = true;

        try {

            recognition.start();

        } catch (error) {

            result.textContent = "حاولي مرة أخرى.";

            micButton.disabled = false;
        }
    };

    recognition.onresult = (event) => {

        const transcript =
            event.results[0][0].transcript;

        result.replaceChildren();

        const message =
            document.createElement("p");

        message.textContent =
            "النص الذي سمعته وصال: " + transcript;

        const speakButton =
            document.createElement("button");

        speakButton.textContent =
            "🔊 استمع إلى النص";

        speakButton.className = "main-button";

        speakButton.style.marginTop = "15px";

        speakButton.onclick = () => {

            window.speechSynthesis.cancel();

            const speech =
                new SpeechSynthesisUtterance(transcript);

            speech.lang = "ar-SA";

            speech.rate = 0.9;

            window.speechSynthesis.speak(speech);
        };

        result.append(message, speakButton);
    };

    recognition.onerror = (event) => {

        if (event.error === "not-allowed") {

            result.textContent =
                "يرجى السماح للمتصفح باستخدام الميكروفون.";

        } else {

            result.textContent =
                "لم نتمكن من سماع الصوت. حاولي مرة أخرى.";
        }
    };

    recognition.onend = () => {

        micButton.disabled = false;
    };
}


// =====================================
// تحميل مكتبة MediaPipe
// =====================================

function loadMediaPipeHands() {

    return new Promise((resolve, reject) => {

        if (window.Hands) {
            resolve();
            return;
        }

        const script = document.createElement("script");

        script.src =
            "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";

        script.onload = resolve;

        script.onerror = () => {

            reject(
                new Error("تعذر تحميل مكتبة MediaPipe")
            );
        };

        document.head.appendChild(script);
    });
}


// =====================================
// نقاط اتصال اليد
// =====================================

const HAND_CONNECTIONS = [

    [0,1], [1,2], [2,3], [3,4],

    [0,5], [5,6], [6,7], [7,8],

    [5,9], [9,10], [10,11], [11,12],

    [9,13], [13,14], [14,15], [15,16],

    [13,17], [17,18], [18,19], [19,20],

    [0,17]
];


// =====================================
// رسم نقاط اليد وجمع البيانات
// =====================================

function drawHandResults(results) {

    const canvas =
        document.getElementById("handCanvas");

    const video =
        document.getElementById("cameraPreview");

    const status =
        document.getElementById("signResult");

    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");

    if (
        canvas.width !== video.videoWidth ||
        canvas.height !== video.videoHeight
    ) {

        canvas.width = video.videoWidth;

        canvas.height = video.videoHeight;
    }

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    const detectedHands =
        results.multiHandLandmarks || [];

    // التقاط بيانات الإشارة
    captureSignFrame(results);

    if (detectedHands.length === 0) {

        if (status) {

            status.textContent =
                "لم يتم اكتشاف اليد. ضعي يدك أمام الكاميرا.";
        }

        return;
    }

    detectedHands.forEach(landmarks => {

        ctx.strokeStyle = "#00C9A7";

        ctx.lineWidth = 4;

        HAND_CONNECTIONS.forEach(([start, end]) => {

            const point1 = landmarks[start];

            const point2 = landmarks[end];

            ctx.beginPath();

            ctx.moveTo(
                point1.x * canvas.width,
                point1.y * canvas.height
            );

            ctx.lineTo(
                point2.x * canvas.width,
                point2.y * canvas.height
            );

            ctx.stroke();
        });

        landmarks.forEach(point => {

            ctx.beginPath();

            ctx.arc(
                point.x * canvas.width,
                point.y * canvas.height,
                5,
                0,
                2 * Math.PI
            );

            ctx.fillStyle = "#176B68";

            ctx.fill();
        });
    });

    if (!isRecording && status) {

        status.textContent =
            "✅ تم اكتشاف " + detectedHands.length +
            " يد بنجاح! يتم تتبع حركة الأصابع الآن.";
    }
}


// =====================================
// تحليل إطارات الكاميرا
// =====================================

async function processHandFrames(video) {

    if (!handsModel || !cameraStream) return;

    if (video.readyState >= 2) {

        try {

            await handsModel.send({
                image: video
            });

        } catch (error) {

            console.error(
                "Hand Tracking Error:",
                error
            );
        }
    }

    if (cameraStream && handsModel) {

        cameraAnimationId =
            requestAnimationFrame(() => {

                processHandFrames(video);
            });
    }
}


// =====================================
// تشغيل الكاميرا والتعرف على اليد
// =====================================

async function startCamera() {

    const video =
        document.getElementById("cameraPreview");

    const status =
        document.getElementById("signResult");

    if (!video) return;

    if (cameraStream) return;

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        status.textContent =
            "يجب فتح الموقع عبر HTTPS أو localhost لتشغيل الكاميرا.";

        return;
    }

    try {

        status.textContent =
            "⏳ جارٍ تشغيل الكاميرا...";

        cameraStream =
            await navigator.mediaDevices.getUserMedia({

                video: true,

                audio: false
            });

        video.srcObject = cameraStream;

        await video.play();

        status.textContent =
            "⏳ جارٍ تحميل نموذج التعرف على اليد...";

        await loadMediaPipeHands();

        handsModel = new Hands({

            locateFile: (file) => {

                return (
                    "https://cdn.jsdelivr.net/npm/@mediapipe/hands/" +
                    file
                );
            }
        });

        handsModel.setOptions({

            maxNumHands: 1,

            modelComplexity: 1,

            minDetectionConfidence: 0.6,

            minTrackingConfidence: 0.6
        });

        handsModel.onResults(drawHandResults);

        status.textContent =
            "✋ ضعي يدك أمام الكاميرا لبدء التعرف عليها.";

        processHandFrames(video);

    } catch (error) {

        console.error("Camera Error:", error);

        stopCamera();

        if (status) {

            status.textContent =
                "تعذر تشغيل التعرف على اليد. تحققي من اتصال الإنترنت والسماح بالكاميرا.";
        }
    }
}


// =====================================
// إيقاف الكاميرا
// =====================================

function stopCamera() {

    // حفظ التسجيل الجاري إن كان كافيًا
    if (isRecording) {
        finishSignRecording();
    }

    if (cameraAnimationId !== null) {

        cancelAnimationFrame(cameraAnimationId);

        cameraAnimationId = null;
    }

    if (handsModel) {

        handsModel.close();

        handsModel = null;
    }

    if (cameraStream) {

        cameraStream.getTracks().forEach(track => {

            track.stop();
        });

        cameraStream = null;
    }

    const video =
        document.getElementById("cameraPreview");

    if (video) {

        video.srcObject = null;
    }

    const canvas =
        document.getElementById("handCanvas");

    if (canvas) {

        const ctx = canvas.getContext("2d");

        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );
    }

    const status =
        document.getElementById("signResult");

    if (status) {

        status.textContent =
            "تم إيقاف الكاميرا.";
    }
}
// ========================================
// WESAL AI - التعرف على إشارات اليد
// MediaPipe Hand Landmarker
// ========================================

let wesalStream = null;
let wesalLandmarker = null;
let wesalRunning = false;

async function startWesalSignAI() {
    if (document.getElementById("wesal-ai-panel")) return;

    const panel = document.createElement("div");
    panel.id = "wesal-ai-panel";

    panel.innerHTML = `
      <div style="
        position:fixed; inset:0; z-index:99999;
        background:#102d2d; color:white;
        display:flex; flex-direction:column;
        align-items:center; justify-content:center;
        padding:20px; font-family:Arial;
      ">
        <h2>🤟 ترجمة لغة الإشارة - وصال</h2>
        <p id="wesal-status">جاري تحميل الذكاء الاصطناعي...</p>

        <div style="position:relative;width:100%;max-width:600px">
          <video id="wesal-video" autoplay playsinline muted
            style="width:100%;border-radius:15px;transform:scaleX(-1)">
          </video>
          <canvas id="wesal-canvas"
            style="position:absolute;inset:0;width:100%;
            height:100%;transform:scaleX(-1)">
          </canvas>
        </div>

        <div id="wesal-result" style="
          background:white;color:#123;padding:18px;
          margin:15px;border-radius:12px;width:90%;
          max-width:500px;text-align:center;font-size:22px;
        ">بانتظار ظهور اليد...</div>

        <button id="wesal-close" style="
          padding:12px 30px;background:#20b8a5;
          color:white;border:0;border-radius:10px;
          font-size:17px;cursor:pointer;
        ">إغلاق الكاميرا</button>
      </div>
    `;

    document.body.appendChild(panel);

    const video = document.getElementById("wesal-video");
    const canvas = document.getElementById("wesal-canvas");
    const ctx = canvas.getContext("2d");
    const status = document.getElementById("wesal-status");
    const resultBox = document.getElementById("wesal-result");

    document.getElementById("wesal-close").onclick = stopWesalSignAI;

    try {
        status.textContent = "جاري تحميل نموذج التعرف على اليد...";

        const mp = await import(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14"
        );

        const vision = await mp.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );

        wesalLandmarker = await mp.HandLandmarker.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
            },
            runningMode: "VIDEO",
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
          }
        );

        wesalStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "user",
                width: 640,
                height: 480
            }
        });

        video.srcObject = wesalStream;
        await video.play();

        wesalRunning = true;
        status.textContent = "تم التشغيل! ضع يدك أمام الكاميرا 🤟";

        function detect() {
            if (!wesalRunning) return;

            if (video.readyState >= 2) {
                if (canvas.width !== video.videoWidth ||
                    canvas.height !== video.videoHeight) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                }

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const detections = wesalLandmarker.detectForVideo(
                    video,
                    performance.now()
                );

                if (detections.landmarks.length > 0) {

    const drawing = new mp.DrawingUtils(ctx);

    detections.landmarks.forEach((landmarks, index) => {

        drawing.drawConnectors(
            landmarks,
            mp.HandLandmarker.HAND_CONNECTIONS,
            { color: index === 0 ? "#20e6bb" : "#ffcc00", lineWidth: 4 }
        );

        drawing.drawLandmarks(
            landmarks,
            { color: "#ffffff", lineWidth: 2 }
        );

    });

    resultBox.textContent = detections.landmarks
    .map((landmarks, index) =>
        `اليد ${index + 1}: ${classifyWesalGesture(landmarks)}`
    )
    .join(" | ");
    status.textContent = "تم تتبع اليدين بنجاح ✓";

} else {
                    resultBox.textContent = "ضع يدك أمام الكاميرا";
                    status.textContent = "في انتظار اليد...";
                }
            }

            requestAnimationFrame(detect);
        }

        detect();

    } catch (error) {
        status.textContent = "حدث خطأ: " + error.message;
        console.error("WESAL AI:", error);
    }
}


// التعرف الأولي على أشكال الأصابع
function classifyWesalGesture(hand) {
    const fingers = [
        hand[8].y < hand[6].y,
        hand[12].y < hand[10].y,
        hand[16].y < hand[14].y,
        hand[20].y < hand[18].y
    ];

    const count = fingers.filter(Boolean).length;
    const thumbUp = hand[4].y < hand[3].y;

    if (count === 4) return "كف مفتوح";
    if (count === 0 && thumbUp) return "إبهام للأعلى";
    if (count === 0) return "قبضة مغلقة";
    if (fingers[0] && fingers[1] && !fingers[2] && !fingers[3])
        return "إشارة النصر";
    if (fingers[0] && !fingers[1] && !fingers[2] && !fingers[3])
        return "رفع السبابة";

    return "حركة يد قيد التحليل";
}


// إيقاف الكاميرا
function stopWesalSignAI() {
    wesalRunning = false;

    if (wesalStream) {
      wesalStream.getTracks().forEach(track => track.stop());  
        wesalStream = null;
    }

    if (wesalLandmarker) {
        wesalLandmarker.close();
        wesalLandmarker = null;
    }

    document.getElementById("wesal-ai-panel")?.remove();
}
// فتح محرك SLI من داخل وصال
function openWesalSignEngine() {
    window.location.href = "/sli-engine/";
}

// أكاديمية وصال - ثلاثة دروس
const oldWesalOpenService = openService;

openService = function(service) {
    if (service !== "academy") {
        return oldWesalOpenService(service);
    }

    stopCamera();
    stopWesalSignAI();
    document.getElementById("service-panel")?.remove();
    document.getElementById("sli-panel")?.remove();

    const panel = document.createElement("section");
    panel.id = "service-panel";
    panel.dir = "rtl";
    panel.style.cssText = [
    "max-width:850px",
    "margin:35px auto",
    "padding:25px",
    "background:white",
    "border-radius:18px",
    "text-align:center",
    "box-shadow:0 5px 25px #0001"
].join(";");
    const lessons = [
        {
            title: "الدرس الأول: التحيات",
            words: [
                { text: "السلام عليكم", url: "https://sshi.sa/category/14/4857" },
                { text: "مرحبًا", url: "https://sshi.sa/category/38/10664" },
                { text: "شكرًا", url: "https://sshi.sa/category/14/5018" }
            ]
        },
        {
            title: "الدرس الثاني: التواصل اليومي",
            words: [
                { text: "نعم", url: "https://sshi.sa/category/23/972" },
                { text: "لا", url: "https://sshi.sa/category/1/30" },
                { text: "مساعدة", url: "https://sshi.sa/category/38/11081" }
            ]
        },
        {
            title: "الدرس الثالث: العائلة",
            words: [
                { text: "أب", url: "https://sshi.sa/category/15/6103" },
                { text: "أم", url: "https://sshi.sa/category/15/6119" },
                { text: "أخ", url: "https://sshi.sa/category/15/6111" }
            ]
        }
    ];

    function addButton(text, onClick) {
        const button = document.createElement("button");
        button.className = "main-button";
        button.textContent = text;
        button.onclick = onClick;
        return button;
    }

    function showLesson(lesson) {
        panel.replaceChildren();

        const heading = document.createElement("h2");
        heading.textContent = "🤟 " + lesson.title;

        const intro = document.createElement("p");
        intro.textContent =
            "اضغطي على مشاهدة الإشارة لفتح شرحها من المصدر السعودي.";

        panel.append(heading, intro);

        lesson.words.forEach((word) => {
            const card = document.createElement("div");
            card.style.cssText =
                "background:#f1f8f7;padding:18px;margin:12px 0;border-radius:14px;";

            const title = document.createElement("h3");
            title.textContent = word.text;

            const link = document.createElement("a");
            link.href = word.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "▶ مشاهدة الإشارة";
            link.style.cssText =
                "display:inline-block;padding:10px 18px;background:#176B68;color:white;text-decoration:none;border-radius:10px;";

            card.append(title, link);
            panel.appendChild(card);
        });

        panel.appendChild(
            addButton("العودة للدروس", showAcademy)
        );
    }

    function showAcademy() {
        panel.replaceChildren();

        const heading = document.createElement("h2");
        heading.textContent = "📚 أكاديمية وصال";
        heading.style.color = "#176B68";

        const intro = document.createElement("p");
        intro.textContent =
            "تعلمي أساسيات لغة الإشارة السعودية من خلال ثلاثة دروس.";

        panel.append(heading, intro);

        lessons.forEach((lesson) => {
            const card = document.createElement("div");
            card.style.cssText =
                "background:#f1f8f7;padding:20px;margin:15px 0;border-radius:14px;";

            const title = document.createElement("h3");
            title.textContent = lesson.title;

            const words = document.createElement("p");
            words.textContent = lesson.words
                .map((word) => word.text)
                .join(" • ");

            card.append(
                title,
                words,
                addButton(
                    "🤟 مشاهدة الإشارات",
                    () => showLesson(lesson)
                )
            );

            panel.appendChild(card);
        });

        panel.appendChild(
            addButton("العودة إلى وصال", () => panel.remove())
        );
    }

    showAcademy();

    const footer = document.querySelector("footer");
    if (footer) footer.before(panel);
    else document.body.appendChild(panel);

    panel.scrollIntoView({ behavior: "smooth" });
};
function openTravelBag() {
    document.getElementById("travel-panel")?.remove();

    const categories = {
        "✈️ المطار": [
            "أحتاج مساعدة في إجراءات السفر",
            "أين بوابة الصعود؟",
            "فقدت جواز سفري"
        ],
        "🏨 الفندق": [
            "أريد تسجيل الدخول",
            "أين غرفتي؟",
            "أحتاج مساعدة من الاستقبال"
        ],
        "🏥 المستشفى": [
            "أنا شخص أصم، يرجى التواصل معي كتابةً",
            "أحتاج إلى طبيب",
            "أشعر بألم وأحتاج مساعدة"
        ],
        "🚕 المواصلات": [
            "أريد الذهاب إلى هذا العنوان",
            "كم تكلفة الرحلة؟",
            "أريد التوقف هنا"
        ],
        "🚨 الطوارئ": [
            "أحتاج إلى مساعدة عاجلة",
            "اتصلوا بالإسعاف من فضلكم",
            "أنا شخص أصم، يرجى التواصل معي كتابةً"
        ]
    };

    const panel = document.createElement("section");
    panel.id = "travel-panel";
    panel.dir = "rtl";
    panel.style.cssText = [
        "max-width:800px",
        "margin:35px auto",
        "padding:25px",
        "background:white",
        "border-radius:18px",
        "text-align:center",
        "box-shadow:0 5px 25px #0001"
    ].join(";");

    const heading = document.createElement("h2");
    heading.textContent = "🧳 حقيبة السفر والطوارئ";

    const intro = document.createElement("p");
    intro.textContent = "اختر الموقف، ثم العبارة المناسبة لعرضها أو نطقها.";

    const content = document.createElement("div");
    panel.append(heading, intro, content);

    function makeButton(label, action) {
        const button = document.createElement("button");
        button.className = "main-button";
        button.textContent = label;
        button.style.margin = "7px";
        button.onclick = action;
        return button;
    }

    function showCategories() {
        content.replaceChildren();

        Object.keys(categories).forEach(category => {
            content.appendChild(
                makeButton(category, () => showPhrases(category))
            );
        });
    }

    function showPhrases(category) {
        content.replaceChildren();

        const title = document.createElement("h3");
        title.textContent = category;
        content.appendChild(title);

        categories[category].forEach(phrase => {
            const card = document.createElement("div");
            card.style.cssText = [
                "background:#f1f8f7",
                "padding:20px",
                "margin:15px 0",
                "border-radius:14px"
            ].join(";");

            const text = document.createElement("p");
            text.textContent = phrase;
            text.style.fontSize = "24px";

            const speak = makeButton("🔊 نطق العبارة", () => {
                if (!("speechSynthesis" in window)) {
                    alert("المتصفح لا يدعم النطق الصوتي.");
                    return;
                }

                speechSynthesis.cancel();

                const voice = new SpeechSynthesisUtterance(phrase);
                voice.lang = "ar-SA";
                voice.rate = 0.9;

                speechSynthesis.speak(voice);
            });

            card.append(text, speak);
            content.appendChild(card);
        });

        content.appendChild(
            makeButton("العودة للأقسام", showCategories)
        );
    }

    showCategories();

    panel.appendChild(
        makeButton("إغلاق الحقيبة", () => {
            speechSynthesis?.cancel();
            panel.remove();
        })
    );

    const services = document.getElementById("services");

    if (services) {
        services.after(panel);
    } else {
        document.body.appendChild(panel);
    }

    panel.scrollIntoView({ behavior: "smooth" });
}