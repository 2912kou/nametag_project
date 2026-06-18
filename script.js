// =====================
// 生徒データ
// =====================

let students =
    JSON.parse(
        localStorage.getItem("students")
    ) || [];

// =====================
// 生徒保存
// =====================

function saveStudents() {

    localStorage.setItem(
        "students",
        JSON.stringify(students)
    );
}

// =====================
// 生徒追加
// =====================

function addStudent() {

    const grade =
        document.getElementById("grade").value;

    const className =
        document.getElementById("class").value;

    const number =
        document.getElementById("number").value;

    const name =
        document.getElementById("name").value.trim();

    if (
        number === "" ||
        name === ""
    ) {

        alert("入力してください");
        return;
    }

    const exists =
        students.some(
            student =>
                student.grade === grade &&
                student.className === className &&
                student.number === number
        );

    if (exists) {

        alert(
            "その出席番号は既に登録されています"
        );

        return;
    }

    students.push({
        grade,
        className,
        number,
        name
    });

    saveStudents();

    displayStudents();

    document.getElementById("number").value = "";
    document.getElementById("name").value = "";
}

// =====================
// 生徒削除
// =====================

function deleteStudent(index) {

    if (
        !confirm(
            "削除しますか？"
        )
    ) {
        return;
    }

    students.splice(index, 1);

    saveStudents();

    displayStudents();
}

// =====================
// 生徒表示
// =====================

function displayStudents() {

    const list =
        document.getElementById(
            "student-list"
        );

    if (!list) return;

    list.innerHTML = "";

    students
        .sort((a, b) => {

            if (
                a.grade !== b.grade
            ) {

                return (
                    Number(a.grade)
                    -
                    Number(b.grade)
                );
            }

            if (
                a.className !== b.className
            ) {

                return a.className.localeCompare(
                    b.className
                );
            }

            return (
                Number(a.number)
                -
                Number(b.number)
            );

        })
        .forEach(
            (student, index) => {

                list.innerHTML += `
                    <p>
                    ${student.grade}年
                    ${student.className}組
                    ${student.number}番
                    ${student.name}

                    <button
                        onclick="deleteStudent(${index})">
                        削除
                    </button>
                    </p>
                `;
            }
        );
}

// =====================
// モデル管理
// =====================

function openTeachableMachine() {

    window.open(
        "https://teachablemachine.withgoogle.com/",
        "_blank"
    );

}

function saveModelUrl() {

    const url =
        document.getElementById(
            "modelUrl"
        ).value.trim();

    if (url === "") {

        alert(
            "URLを入力してください"
        );

        return;
    }

    localStorage.setItem(
        "modelUrl",
        url
    );

    alert(
        "保存しました"
    );

    displayModelUrl();
}

function displayModelUrl() {

    const current =
        document.getElementById(
            "current-model"
        );

    if (!current) return;

    const url =
        localStorage.getItem(
            "modelUrl"
        );

    current.textContent =
        url || "未設定";
}

// =====================
// 履歴管理
// =====================

let attendanceHistory =
    JSON.parse(
        localStorage.getItem(
            "attendanceHistory"
        )
    ) || [];

function saveHistory() {

    localStorage.setItem(
        "attendanceHistory",
        JSON.stringify(
            attendanceHistory
        )
    );
}

function displayHistory() {

    const list =
        document.getElementById(
            "history-list"
        );

    if (!list) return;

    list.innerHTML = "";

    attendanceHistory
        .slice()
        .reverse()
        .forEach(record => {

            list.innerHTML += `
                <p>
                ${record.date}
                ${record.time}
                <br>

                ${record.grade}年
                ${record.className}組
                ${record.number}番

                ${record.name}
                </p>

                <hr>
            `;
        });
}

function clearHistory() {

    if (
        !confirm(
            "履歴を削除しますか？"
        )
    ) {
        return;
    }

    attendanceHistory = [];

    saveHistory();

    displayHistory();
}

// =====================
// テスト用登録
// =====================

function addAttendanceRecord(
    student
) {

    const now =
        new Date();

    const date =
        now.toLocaleDateString(
            "ja-JP"
        );

    const time =
        now.toLocaleTimeString(
            "ja-JP"
        );

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

    // 出席と同時にGoogle Chatへ通知
    sendNotificationToGoogleChat(record);
}

// =====================
// Google Chat 通知
// =====================

function sendNotificationToGoogleChat(record) {

    const webhookUrl =
        localStorage.getItem(
            "googleChatWebhookUrl"
        );

    if (!webhookUrl) return; // 設定されていなければ何もしない

    const messageText =
        `【出席通知】\n${record.date} ${record.time}\n${record.grade}年 ${record.className}組 ${record.number}番\n${record.name} さんが出席しました。`;

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

// =====================
// 初期表示
// =====================

displayStudents();

displayModelUrl();

displayHistory();

// =====================
// AI出席判定
// =====================

let model = null;
let webcam = null;

const THRESHOLD = 0.90;

// =====================
// 出席判定開始
// =====================

async function startAttendance() {

    const modelUrl =
        localStorage.getItem(
            "modelUrl"
        );

    if (!modelUrl) {

        alert(
            "モデルURLが設定されていません"
        );

        return;
    }

    try {

        document.getElementById(
            "result-box"
        ).textContent =
            "モデル読み込み中...";

        model =
            await tmImage.load(
                modelUrl + "model.json",
                modelUrl + "metadata.json"
            );

        webcam =
            new tmImage.Webcam(
                400,
                300,
                true
            );

        await webcam.setup();

        await webcam.play();

        const camera =
            document.getElementById(
                "camera"
            );

        camera.innerHTML = "";

        camera.appendChild(
            webcam.canvas
        );

        requestAnimationFrame(
            loop
        );

    } catch (error) {

        console.error(error);

        document.getElementById(
            "result-box"
        ).textContent =
            "モデル読込失敗";

    }
}

// =====================
// ループ
// =====================

async function loop() {

    webcam.update();

    await predict();

    requestAnimationFrame(
        loop
    );
}

// =====================
// AI判定
// =====================

async function predict() {

    const preds =
        await model.predict(
            webcam.canvas
        );

    const top3 =
        [...preds]
        .sort(
            (a,b)=>
                b.probability -
                a.probability
        )
        .slice(0,3);

    document.getElementById(
        "score"
    ).innerHTML =
        top3
        .map(
            p =>
                `${p.className}
                :
                ${(p.probability*100).toFixed(1)}%`
        )
        .join("<br>");

    const best =
        top3[0];

    const fumei =
        preds.find(
            p =>
                p.className ===
                "不明"
        );

    const box =
        document.getElementById(
            "result-box"
        );

    // 不明判定
    if (
        fumei &&
        fumei.probability >=
        THRESHOLD
    ) {

        box.textContent =
            "❌ 名札なし";

        box.className =
            "ng";

        return;
    }

    // 生徒判定
    if (
        best.className !==
        "不明" &&
        best.probability >=
        THRESHOLD
    ) {

        processAttendance(
            best.className
        );

        return;
    }

    // あいまい判定
    if (
        best.className !==
        "不明"
    ) {

        box.textContent =
            "⚠️ 名札あり（個人不明）";

        box.className =
            "warn";

        return;
    }

    box.textContent =
        "🔍 判定中...";

    box.className =
        "wait";
}

// =====================
// 出席処理
// =====================

function processAttendance(
    studentName
) {

    const student =
        students.find(
            s =>
                s.name ===
                studentName
        );

    if (!student) {

        document.getElementById(
            "result-box"
        ).textContent =
            "生徒情報なし";

        return;
    }

    document.getElementById(
        "grade-view"
    ).textContent =
        student.grade;

    document.getElementById(
        "class-view"
    ).textContent =
        student.className;

    document.getElementById(
        "number-view"
    ).textContent =
        student.number;

    document.getElementById(
        "name-view"
    ).textContent =
        student.name;

    const today =
        new Date()
        .toLocaleDateString(
            "ja-JP"
        );

    const already =
        attendanceHistory.some(
            h =>
                h.name ===
                student.name &&
                h.date ===
                today
        );

    const box =
        document.getElementById(
            "result-box"
        );

    // 同日重複防止
    if (already) {

        box.textContent =
            "⚠️ 出席済み";

        box.className =
            "warn";

        return;
    }

    addAttendanceRecord(
        student
    );

    box.textContent =
        `✅ ${student.name}さん 出席登録`;

    box.className =
        "ok";
}

// =====================
// モデル表示
// =====================

const currentModel =
    document.getElementById(
        "current-model"
    );

if (currentModel) {

    currentModel.textContent =
        localStorage.getItem(
            "modelUrl"
        ) || "未設定";
}