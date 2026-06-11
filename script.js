// =====================
// モデル設定
// =====================

const MODEL_URL =
    "https://teachablemachine.withgoogle.com/models/uCT875y1o/";

const THRESHOLD = 0.80;

let model;
let webcam;

// =====================
// 出席管理
// =====================

let attendedStudents = [];

// 今日の日付
const today = new Date().toISOString().split("T")[0];

// 保存されている日付
const savedDate = localStorage.getItem("attendanceDate");

// 日付が変わったらリセット
if (savedDate !== today) {
    localStorage.removeItem("attendance");
    localStorage.setItem("attendanceDate", today);
}

// 出席済みリスト読み込み
attendedStudents =
    JSON.parse(localStorage.getItem("attendance")) || [];

// =====================
// 初期化
// =====================

async function init() {

    const box =
        document.getElementById("result-box");

    try {

        box.textContent =
            "モデル読み込み中...";

        model = await tmImage.load(
            MODEL_URL + "model.json",
            MODEL_URL + "metadata.json"
        );

        console.log("モデル読込成功");

    } catch (error) {

        console.error(error);

        box.textContent =
            "❌ モデル読込失敗";

        box.className = "ng";

        return;
    }

    try {

        webcam =
            new tmImage.Webcam(
                400,
                300,
                true
            );

        await webcam.setup();
        await webcam.play();

        document
            .getElementById("canvas")
            .appendChild(webcam.canvas);

        console.log("カメラ起動成功");

    } catch (error) {

        console.error(error);

        box.textContent =
            "❌ カメラ起動失敗";

        box.className = "ng";

        return;
    }

    requestAnimationFrame(loop);
}

// =====================
// メインループ
// =====================

async function loop() {

    webcam.update();

    await predict();

    requestAnimationFrame(loop);
}

// =====================
// 判定処理
// =====================

async function predict() {

    const preds =
        await model.predict(webcam.canvas);

    const box =
        document.getElementById("result-box");

    const score =
        document.getElementById("score");

    const meifuda =
        preds.find(
            p => p.className === "名札あり"
        );

    const fumei =
        preds.find(
            p => p.className === "不明"
        );

    // 名札あり
    if (
        meifuda &&
        meifuda.probability >= THRESHOLD
    ) {

        box.textContent =
            "✅ 名札あり";

        box.className = "ok";

        if (
            !attendedStudents.includes("名札あり")
        ) {

            attendedStudents.push("名札あり");

            localStorage.setItem(
                "attendance",
                JSON.stringify(
                    attendedStudents
                )
            );

            console.log("出席登録");
        }

    }
    // 不明
    else if (
        fumei &&
        fumei.probability >= THRESHOLD
    ) {

        box.textContent =
            "❌ 名札なし";

        box.className = "ng";

    }
    // 判定中
    else {

        box.textContent =
            "🔍 判定中...";

        box.className = "wait";
    }

    // 上位2件表示
    const top2 =
        [...preds]
            .sort(
                (a, b) =>
                    b.probability - a.probability
            )
            .slice(0, 2);

    score.textContent =
        top2
            .map(
                p =>
                    `${p.className}: ${(p.probability * 100).toFixed(1)}%`
            )
            .join(" ／ ");
}

// =====================
// 起動
// =====================

init();