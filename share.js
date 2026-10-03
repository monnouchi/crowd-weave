export const GAME_URL = "https://monnouchi.github.io/crowd-weave/";
export function resultTotals(records) {
  const time = records.reduce((s, r) => s + r.time, 0),
    hits = records.reduce((s, r) => s + r.hits, 0),
    safetyStops = records.reduce((s, r) => s + (r.safetyStops || 0), 0);
  const clean = records.length === 5 && hits === 0 && safetyStops === 0;
  return {
    time,
    hits,
    safetyStops,
    clean,
    label: clean ? "すきまの名案内" : "みんなで最前列",
  };
}
export function resultText(records) {
  const r = resultTotals(records);
  return `雑踏突破 / Crowd Weave\n全5ステージ ${r.time.toFixed(1)}秒・接触${r.hits}回\n急停止${r.safetyStops}回 · ${r.label}\n${GAME_URL}`;
}
export async function shareResult(records, scene) {
  const text = resultText(records),
    c = document.createElement("canvas");
  c.width = 720;
  c.height = 560;
  const x = c.getContext("2d");
  x.fillStyle = "#edf0e4";
  x.fillRect(0, 0, 720, 560);
  x.drawImage(scene, 440, 25, 250, 354);
  x.fillStyle = "#245c56";
  x.font = "bold 44px system-ui";
  x.fillText("雑踏突破", 35, 85);
  x.font = "24px system-ui";
  x.fillText("Crowd Weave", 35, 125);
  x.font = "bold 28px system-ui";
  x.fillText("全5ステージ踏破！", 35, 195);
  const lines = text.split("\n");
  x.font = "20px system-ui";
  x.fillText(lines[1], 35, 250);
  x.font = "18px system-ui";
  x.fillText(lines[2], 35, 285);
  x.font = "17px system-ui";
  x.fillText(GAME_URL, 35, 490);
  x.fillText("人の流れに、すきまを見つけよう。", 35, 530);
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
