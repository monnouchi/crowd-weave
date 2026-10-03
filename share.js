export const GAME_URL = "https://monnouchi.github.io/crowd-weave/";
export function resultTotals(records) {
  const time = records.reduce((s, r) => s + r.time, 0),
    hits = records.reduce((s, r) => s + r.hits, 0),
    violations = records.reduce((s, r) => s + (r.violations || 0), 0);
  const clean = records.length === 5 && hits === 0 && violations === 0;
  return {
    time,
    hits,
    violations,
    clean,
    label: clean ? "すきまの名案内" : "みんなで最前列",
  };
}
export function resultText(records) {
  const r = resultTotals(records);
  return `雑踏突破 / Crowd Weave\n全5ステージ ${r.time.toFixed(1)}秒・接触${r.hits}回\n信号無視${r.violations}回 · ${r.label}\n${GAME_URL}`;
}
export function drawResultCard(records, scene) {
  const totals = resultTotals(records),
    c = document.createElement("canvas");
  c.width = 720;
  c.height = 520;
  const x = c.getContext("2d");
  x.fillStyle = "#edf0e4";
  x.fillRect(0, 0, 720, 520);
  const ratio = scene.width / 480;
  x.drawImage(
    scene,
    95 * ratio,
    20 * ratio,
    300 * ratio,
    215 * ratio,
    330,
    145,
    350,
    251,
  );
  x.fillStyle = "#245c56";
  x.font = "bold 44px system-ui";
  x.fillText("雑踏突破", 35, 72);
  x.font = "20px system-ui";
  x.fillText("Crowd Weave", 275, 69);
  x.font = "bold 24px system-ui";
  x.fillText("仲間全員、ライブ最前列へ！", 35, 112);
  x.fillStyle = "#567777";
  x.font = "14px system-ui";
  x.fillText("全5区間 / 到着タイム", 35, 188);
  x.fillStyle = "#245c56";
  x.font = "bold 38px system-ui";
  x.fillText(`${totals.time.toFixed(1)} 秒`, 35, 238);
  x.font = "20px system-ui";
  x.fillText(`接触 ${totals.hits}回`, 35, 292);
  x.fillText(`信号無視 ${totals.violations}回`, 35, 332);
  x.font = "bold 19px system-ui";
  x.fillText(totals.label, 35, 390);
  x.font = "17px system-ui";
  x.fillText(GAME_URL, 35, 480);
  return c;
}
export async function shareResult(records, scene) {
  const text = resultText(records),
    c = drawResultCard(records, scene);
  const blob = await new Promise((resolve) => c.toBlob(resolve, "image/png"));
  if (!blob) throw Error("画像を作成できませんでした");
  const file = new File([blob], "crowd-weave-result.png", {
    type: "image/png",
  });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({
        title: "雑踏突破 / Crowd Weave",
        text,
        files: [file],
      });
      return "共有メニューを開きました";
    } catch (e) {
      if (e.name === "AbortError") return "共有をキャンセルしました";
    }
  }
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return "結果画像を保存しました。文章は「文章コピー」からコピーできます";
}
