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
let isProcessing = false; // 連続判定防止・モード固定フラグ
let currentDetectedStudent = null; // 現在撮影モードに進んでいる生徒データ
let predictIntervalId = null; // ⏱️ 判定間隔をコントロールするタイマーID

const THRESHOLD = 0.96; // 判定のしきい値（96%以上に設定）
const INTERVAL_TIME = 1000; // ⏱️ 判定の間隔（1000ミリ秒 ＝ 1秒に1回）

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
    if (document.getElementById("history-list")) displayHistory();

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
    if (document.getElementById("history-list")) displayHistory();
}

function displayStudents() {
    const list = document.getElementById("student-list");
    if (!list) return;

    list.innerHTML = "";

    [...students]
        .sort((a, b) => {
            if (a.grade !== b.grade) return Number(a.grade) - Number(b.grade);
            if (a.className !== b.className) return a.className.localeCompare(b.className);
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

    const modelReader = new FileReader();
    modelReader.onload = function(e) {
        loadedModelJsonText = e.target.result;
        localStorage.setItem("localModelJson", loadedModelJsonText);

        const metadataReader = new FileReader();
        metadataReader.onload = function(e2) {
            loadedMetadataJsonText = e2.target.result;
            localStorage.setItem("localMetadataJson", loadedMetadataJsonText);
            
            const weightsReader = new FileReader();
            weightsReader.onload = function(e3) {
                loadedWeightsBinBase64 = e3.target.result;
                localStorage.setItem("localWeightsBin", loadedWeightsBinBase64);

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

    if (students.length === 0) {
        list.innerHTML = "<p style='color:#888;'>生徒が登録されていません。「生徒管理」から登録してください。</p>";
        return;
    }

    list.innerHTML = "";
    const today = new Date().toLocaleDateString("ja-JP");

    const sortedStudents = [...students].sort((a, b) => {
        if (a.grade !== b.grade) return Number(a.grade) - Number(b.grade);
        if (a.className !== b.className) return a.className.localeCompare(b.className);
        return Number(a.number) - Number(b.number);
    });

    sortedStudents.forEach(student => {
        const record = attendanceHistory.find(h => h.name === student.name && h.date === today);

        let statusHtml = "";
        if (record) {
            const imgHtml = record.photo 
                ? `<img src="${record.photo}" style="width: 100px; height: 75px; border-radius: 4px; border: 1px solid #ccc; margin-left: 15px;" alt="エビデンス画像">` 
                : '<div style="width: 100px; height: 75px; background: #eee; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #888; margin-left: 15px; border-radius: 4px;">写真なし</div>';

            statusHtml = `
                <div style="display: flex; align-items: center;">
                    <div style="text-align: right; margin-right: 15px;">
                        <span style="font-size: 13px; color: #28a745; font-weight: bold;">🟢 出席完了</span><br>
                        <span style="font-size: 11px; color: #666;">${record.time}</span>
                    </div>
                    ${imgHtml}
                    <button onclick="deleteSingleHistory('${student.name}')" style="margin-left: 15px; padding: 4px 8px; font-size: 11px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer;">
                        取消
                    </button>
                </div>
            `;
        } else {
            statusHtml = `
                <span style="font-size: 13px; color: #dc3545; font-weight: bold; padding-right: 20px;">❌ 未出席</span>
            `;
        }

        list.innerHTML += `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; margin-bottom: 5px; background: ${record ? '#f1fbf4' : '#fff5f5'}; border-radius: 6px; border: 1px solid ${record ? '#c3e6cb' : '#f5c6cb'};">
                <div>
                    <strong style="font-size: 14px;">${student.grade}年 ${student.className}組 ${student.number}番</strong><br>
                    <span style="font-size: 16px; margin-left: 5px;">${student.name}</span>
                </div>
                ${statusHtml}
            </div>
        `;
    });
}

function deleteSingleHistory(studentName) {
    const today = new Date().toLocaleDateString("ja-JP");
    if (!confirm(`${studentName} さんの「今日」の出席を未出席に戻しますか？`)) {
        return;
    }

    attendanceHistory = attendanceHistory.filter(h => !(h.name === studentName && h.date === today));
    saveHistory();
    displayHistory();
}

function clearHistory() {
    if (!confirm("すべての履歴を完全に一括削除しますか？")) {
        return;
    }
    attendanceHistory = [];
    saveHistory();
    displayHistory();
}

function addAttendanceRecord(student, photoData = null) {
    const now = new Date();
    const date = now.toLocaleDateString("ja-JP");
    const time = now.toLocaleTimeString("ja-JP");

    const record = {
        date,
        time,
        grade: student.grade,
        className: student.className,
        number: student.number,
        name: student.name,
        photo: photoData 
    };

    attendanceHistory.push(record);
    saveHistory();
    displayHistory();

    sendNotificationToGoogleChat(record);
}

function sendNotificationToGoogleChat(record) {
    const webhookUrl = localStorage.getItem("googleChatWebhookUrl");

    if (!webhookUrl) return; 

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
// 5. AI出席判定コア機能（1秒に1回ゆったり判定タイマー版）
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

        webcam = new tmImage.Webcam(400, 300, true);
        await webcam.setup();
        await webcam.play();

        const cameraContainer = document.getElementById("camera");
        if (cameraContainer) {
            cameraContainer.innerHTML = "";
            cameraContainer.appendChild(webcam.canvas);
        }

        isProcessing = false;
        
        // 🔄 カメラの描画更新はブラウザ任せで最速で動かす（映像がカクつかないように）
        function updateWebcamVideo() {
            if (webcam) webcam.update();
            requestAnimationFrame(updateWebcamVideo);
        }
        requestAnimationFrame(updateWebcamVideo);

        // ⏱️ AIの「判定処理」だけを1秒（1000ms）に1回に固定して起動！
        if (predictIntervalId) clearInterval(predictIntervalId);
        predictIntervalId = setInterval(predict, INTERVAL_TIME);

    } catch (error) {
        console.error(error);
        if (resultBox) resultBox.textContent = "モデル読込失敗";
    }
}

async function predict() {
    if (!model || !webcam) return;

    // 🔒 すでに確認中・撮影中の場合は絶対に処理を通さない
    if (isProcessing) return;

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

    // 🎯 1秒に1回のチャンスで条件をクリアした場合
    if (best.className !== "不明" && best.probability >= THRESHOLD) {
        isProcessing = true; // 1. 即座に処理中ロック
        clearInterval(predictIntervalId); // 2. 判定タイマーを完全に止める（重複を物理的に防止）

        // 次のタイマーが割り込む隙をなくすため、すぐメイン処理へ
        processAttendance(best.className);
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
        restartScannerImmediately();
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
        setTimeout(restartScannerImmediately, 7000); // 7秒後に自動再開
        return;
    }

    // 名前のポップアップ表示（この時AIの判定タイマーは完全に消滅しているので絶対に重なりません）
    const message = student.grade + "年 " + student.className + "組 " + student.number + "番 " + student.name + " さんですか？";
    const isCorrect = confirm(message);

    if (isCorrect) {
        currentDetectedStudent = student;

        if (box) {
            box.className = "warn";
            box.innerHTML = `
                <div style="padding: 5px;">
                    <p style="margin: 0 0 8px 0; font-weight: bold; color: #333;">📸 ${student.name} さんの顔を映して撮影してください</p>
                    <button onclick="takeManualPhotoAndRegister()" style="padding: 8px 15px; font-size: 14px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; margin-right: 10px;">
                        パシャリ（撮影して登録）
                    </button>
                    <button onclick="cancelPhotoMode()" style="padding: 8px 15px; font-size: 14px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        キャンセル
                    </button>
                </div>
            `;
        }
    } else {
        if (box) { box.textContent = "❌ キャンセルされました"; box.className = "ng"; }
        restartScannerImmediately(); // すぐスキャンを再開
    }
}

function takeManualPhotoAndRegister() {
    if (!currentDetectedStudent) return;

    let capturedPhoto = null;
    if (webcam && webcam.canvas) {
        capturedPhoto = webcam.canvas.toDataURL("image/jpeg", 0.7);
    }

    addAttendanceRecord(currentDetectedStudent, capturedPhoto);
    
    const box = document.getElementById("result-box");
    if (box) { 
        box.innerHTML = `✅ ${currentDetectedStudent.name} さんを出席登録しました`; 
        box.className = "ok"; 
    }

    currentDetectedStudent = null;
    setTimeout(restartScannerImmediately, 7000); // 完了文字を7秒間見せてから再開
}

function cancelPhotoMode() {
    currentDetectedStudent = null;
    const box = document.getElementById("result-box");
    if (box) { 
        box.innerHTML = "❌ キャンセルされました"; 
        box.className = "ng"; 
    }
    restartScannerImmediately();
}

// 🔽 スキャナーの判定タイマーを完全にリセットして1秒おきのペースで再開する関数
function restartScannerImmediately() {
    currentDetectedStudent = null;
    isProcessing = false;
    
    if (predictIntervalId) clearInterval(predictIntervalId);
    predictIntervalId = setInterval(predict, INTERVAL_TIME); // 1秒間隔のタイマーを再セット
}

// ==========================================
// 6. ページ読み込み時の初期化処理
// ==========================================
if (document.getElementById("student-list")) displayStudents();
if (document.getElementById("local-model-status") || document.getElementById("local-model-time")) displayModelStatus();
if (document.getElementById("history-list")) displayHistory();

// ==========================================
// 7. 外部連携機能
// ==========================================
function openTeachableMachine() {
    window.open("https://teachablemachine.withgoogle.com/", "_blank");
}