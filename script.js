
// ==========================================
// 1. 状態管理（データ初期化）
// ==========================================

// 生徒データ
let students = JSON.parse(localStorage.getItem("students")) || [];

// 出席履歴データ
let attendanceHistory = JSON.parse(localStorage.getItem("attendanceHistory")) || [];

// AI判定用のグローバル変数
let model = null;
let webcam = null;
let isProcessing = false; // 連続判定防止フラグ

const THRESHOLD = 0.96; // 判定のしきい値（96%以上に設定）

// インポートされたローカルファイルのデータを保存する変数
let loadedModelJsonText = localStorage.getItem("localModelJson") || null;
let loadedMetadataJsonText = localStorage.getItem("localMetadataJson") || null;
let loadedWeightsBinBase64 = localStorage.getItem("localWeightsBin") || null;

// インポートされた日時を記憶する変数
let loadedModelTime = localStorage.getItem("localModelTime") || "なし";

// ==========================================
// 2. 生徒管理機能
// ==========================================

function saveStudents() {
    localStorage.setItem("students", JSON.stringify(students));
}

function addStudent() {
    const gradeElement = document.getElementById("grade");
    const classElement = document.getElementById("class");
    const numberElement = document.getElementById("number");
    const nameElement = document.getElementById("name");

    if (!gradeElement || !classElement || !numberElement || !nameElement) return;

    const grade = gradeElement.value;
    const className = classElement.value;
    const number = numberElement.value;
    const name = nameElement.value.trim();

    if (number === "" || name === "") {

        alert("入力してください");
        return;
    }


    const exists = students.some(
        student => student.grade === grade &&
                   student.className === className &&
                   student.number === number
    );

    if (exists) {
        alert("その出席番号は既に登録されています");
        return;
    }

    students.push({ grade, className, number, name });
    saveStudents();
    displayStudents();

    numberElement.value = "";
    nameElement.value = "";
}

function deleteStudent(grade, className, number, name) {
    if (!confirm(name + " さんを削除しますか？")) {
        return;
    }

    students = students.filter(
        student => !(student.grade === grade && 
                     student.className === className && 
                     student.number === number)
    );

    saveStudents();
    displayStudents();
}

function displayStudents() {
    const list = document.getElementById("student-list");
    if (!list) return;

    list.innerHTML = "";


    [...students]
        .sort((a, b) => {
            if (a.grade !== b.grade) {
                return Number(a.grade) - Number(b.grade);
            }
            if (a.className !== b.className) {
                return a.className.localeCompare(b.className);
            }
            return Number(a.number) - Number(b.number);
        })
        .forEach(student => {
            list.innerHTML += `
                <p>
                    ${student.grade}年 ${student.className}組 ${student.number}番 ${student.name}
                    <button onclick="deleteStudent('${student.grade}', '${student.className}', '${student.number}', '${student.name}')">
                        削除
                    </button>
                </p>
            `;
        });
}

// ==========================================
// 3. AIモデル「3ファイル一括貼り付け（インポート）」機能
// ==========================================

function importModelFiles() {
    const fileInput = document.getElementById("modelFiles");
    if (!fileInput || fileInput.files.length < 3) {
        alert("model.json、metadata.json、weights.bin の3つのファイルを同時に選択してください。");
        return;
    }

    let modelFile = null;
    let metadataFile = null;
    let weightsFile = null;

    for (let i = 0; i < fileInput.files.length; i++) {
        const file = fileInput.files[i];
        if (file.name === "model.json") modelFile = file;
        if (file.name === "metadata.json") metadataFile = file;
        if (file.name === "weights.bin") weightsFile = file;
    }

    if (!modelFile || !metadataFile || !weightsFile) {
        alert("ファイルが足りないか、名前が違います。「model.json」「metadata.json」「weights.bin」を選択してください。");
        return;
    }

    // 1. model.jsonの読み込み（テキスト）
    const modelReader = new FileReader();
    modelReader.onload = function(e) {
        loadedModelJsonText = e.target.result;
        localStorage.setItem("localModelJson", loadedModelJsonText);

        // 2. metadata.jsonの読み込み（テキスト）
        const metadataReader = new FileReader();
        metadataReader.onload = function(e2) {
            loadedMetadataJsonText = e2.target.result;
            localStorage.setItem("localMetadataJson", loadedMetadataJsonText);
            
            // 3. weights.binの読み込み（バイナリをBase64テキストに変換して保存）
            const weightsReader = new FileReader();
            weightsReader.onload = function(e3) {
                loadedWeightsBinBase64 = e3.target.result;
                localStorage.setItem("localWeightsBin", loadedWeightsBinBase64);

                // インポート成功時の日時を取得
                const now = new Date();
                const formattedTime = now.getFullYear() + "/" + 
                                      (now.getMonth() + 1) + "/" + 
                                      now.getDate() + " " + 
                                      now.getHours().toString().padStart(2, '0') + ":" + 
                                      now.getMinutes().toString().padStart(2, '0');

                loadedModelTime = formattedTime;
                localStorage.setItem("localModelTime", loadedModelTime);

                alert("3つのAIモデルファイルをアプリ内に完全に適用しました！");
                displayModelStatus();
            };
            weightsReader.readAsDataURL(weightsFile);
        };
        metadataReader.readAsText(metadataFile);
    };
    modelReader.readAsText(modelFile);
}

function displayModelStatus() {
    const statusElement = document.getElementById("local-model-status");
    const timeElement = document.getElementById("local-model-time");

    if (statusElement) {
        if (loadedModelJsonText && loadedMetadataJsonText && loadedWeightsBinBase64) {
            statusElement.textContent = "✅ 最新モデル適用済み（ローカル・3ファイル完全同期）";
            statusElement.style.color = "green";
        } else {
            statusElement.textContent = "❌ 未読み込み（3つのファイルを貼り付けてください）";
            statusElement.style.color = "red";
        }
    }

    if (timeElement) {
        timeElement.textContent = loadedModelTime;
    }
}

// ==========================================
// 4. 出席履歴管理機能 & 通知機能
// ==========================================

function saveHistory() {
    localStorage.setItem("attendanceHistory", JSON.stringify(attendanceHistory));
}

function displayHistory() {
    const list = document.getElementById("history-list");

    if (!list) return;

    list.innerHTML = "";


    [...attendanceHistory]
        .reverse()
        .forEach(record => {
            list.innerHTML += `
                <p>
                    ${record.date} ${record.time}<br>
                    ${record.grade}年 ${record.className}組 ${record.number}番 ${record.name}
                </p>

                <hr>
            `;
        });
}

function clearHistory() {

    if (!confirm("履歴を削除しますか？")) {
        return;
    }
    attendanceHistory = [];
    saveHistory();
    displayHistory();
}

function addAttendanceRecord(student) {
    const now = new Date();
    const date = now.toLocaleDateString("ja-JP");
    const time = now.toLocaleTimeString("ja-JP");

    const record = {
        date,
        time,
        grade: student.grade,
        className: student.className,
        number: student.number,
        name: student.name
    };

    attendanceHistory.push(record);

    saveHistory();
    displayHistory();

    // 🔽 【追加】出席登録と同時にGoogle Chatへ通知を飛ばす
    sendNotificationToGoogleChat(record);
}

// 🔽 【追加】Google Chat 通知コアシステム
function sendNotificationToGoogleChat(record) {
    const webhookUrl = localStorage.getItem("googleChatWebhookUrl");

    if (!webhookUrl) return; // WebhookのURLがブラウザに未設定ならスルー

    const messageText = `【出席通知】\n${record.date} ${record.time}\n${record.grade}年 ${record.className}組 ${record.number}番\n${record.name} さんが出席しました。`;


    fetch(webhookUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
            text: messageText
        })
    })
    .catch(error => {
        console.error('Google Chat送信エラー:', error);
    });
}


// ==========================================
// 5. AI出席判定コア機能（3つのインポートデータから完全オフライン起動版）
// ==========================================

async function startAttendance() {
    const resultBox = document.getElementById("result-box");
    
    if (!loadedModelJsonText || !loadedMetadataJsonText || !loadedWeightsBinBase64) {
        alert("アプリ内にモデルファイルが不足しています。設定画面で3つのファイルをインポートしてください。");
        return;
    }

    if (resultBox) resultBox.textContent = "ローカルモデル（完全版）読み込み中...";

    try {
        const modelBlob = new Blob([loadedModelJsonText], { type: "application/json" });
        const metadataBlob = new Blob([loadedMetadataJsonText], { type: "application/json" });

        const response = await fetch(loadedWeightsBinBase64);
        const weightsBlob = await response.blob();

        const modelFile = new File([modelBlob], "model.json");
        const metadataFile = new File([metadataBlob], "metadata.json");
        const weightsFile = new File([weightsBlob], "weights.bin");

        model = await tmImage.loadFromFiles(modelFile, weightsFile, metadataFile);

        // ウェブカメラの設定
        webcam = new tmImage.Webcam(400, 300, true);
        await webcam.setup();
        await webcam.play();

        const cameraContainer = document.getElementById("camera");
        if (cameraContainer) {
            cameraContainer.innerHTML = "";
            cameraContainer.appendChild(webcam.canvas);
        }

        requestAnimationFrame(loop);

    } catch (error) {
        console.error(error);
        if (resultBox) resultBox.textContent = "モデル読込失敗";
    }
}

function loop() {
    if (!webcam) return;
    webcam.update();
    predict();
    requestAnimationFrame(loop);
}

async function predict() {
    if (!model || !webcam) return;

    const preds = await model.predict(webcam.canvas);
    const top3 = [...preds].sort((a, b) => b.probability - a.probability).slice(0, 3);

    const scoreElement = document.getElementById("score");
    if (scoreElement) {
        scoreElement.innerHTML = top3
            .map(p => p.className + ": " + (p.probability * 100).toFixed(1) + "%")
            .join("<br>");
    }

    const best = top3[0];
    const fumei = preds.find(p => p.className === "不明");
    const box = document.getElementById("result-box");

    if (!box) return;

    if (fumei && fumei.probability >= THRESHOLD) {
        box.textContent = "❌ 名札なし";
        box.className = "ng";
        return;
    }

    if (best.className !== "不明" && best.probability >= THRESHOLD) {
        if (!isProcessing) {
            isProcessing = true;
            processAttendance(best.className);
            setTimeout(function() { isProcessing = false; }, 7000);
        }
        return;
    }

    if (best.className !== "不明") {
        box.textContent = "⚠️ 名札あり（個人不明）";
        box.className = "warn";
        return;
    }

    box.textContent = "🔍 判定中...";
    box.className = "wait";
}

function processAttendance(studentName) {
    const student = students.find(s => s.name === studentName);
    const box = document.getElementById("result-box");

    if (!student) {
        if (box) box.textContent = "生徒情報なし";
        return;
    }

    const gradeView = document.getElementById("grade-view");
    const classView = document.getElementById("class-view");
    const numberView = document.getElementById("number-view");
    const nameView = document.getElementById("name-view");

    if (gradeView) gradeView.textContent = student.grade;
    if (classView) classView.textContent = student.className;
    if (numberView) numberView.textContent = student.number;
    if (nameView) nameView.textContent = student.name;

    const today = new Date().toLocaleDateString("ja-JP");
    const already = attendanceHistory.some(h => h.name === student.name && h.date === today);

    if (already) {
        if (box) { box.textContent = "⚠️ 出席済み"; box.className = "warn"; }
        return;
    }

    const message = student.grade + "年 " + student.className + "組 " + student.number + "番 " + student.name + " さんですか？";
    const isCorrect = confirm(message);

    if (isCorrect) {
        addAttendanceRecord(student); // 内部で履歴追加とチャット通知が走ります
        if (box) { box.textContent = "✅ 出席登録しました"; box.className = "ok"; }
    } else {
        if (box) { box.textContent = "❌ キャンセルされました"; box.className = "ng"; }
    }
}

// ==========================================
// 6. ページ読み込み時の初期化処理
// ==========================================
if (document.getElementById("student-list")) displayStudents();
if (document.getElementById("local-model-status") || document.getElementById("local-model-time")) displayModelStatus();
if (document.getElementById("history-list")) displayHistory();

