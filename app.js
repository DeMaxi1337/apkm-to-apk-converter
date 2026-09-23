(() => {
  "use strict";

  const MAX_INPUT_BYTES = 1024 * 1024 * 1024;

  const input = document.getElementById("file-input");
  const dropzone = document.getElementById("dropzone");
  const fileRow = document.getElementById("file-row");
  const fileName = document.getElementById("file-name");
  const fileMeta = document.getElementById("file-meta");
  const clearBtn = document.getElementById("clear-btn");
  const statusCode = document.getElementById("status-code");
  const statusText = document.getElementById("status-text");
  const statusDot = document.querySelector(".dot");
  const convertBtn = document.getElementById("convert-btn");
  const result = document.getElementById("result");
  const resultTitle = document.getElementById("result-title");
  const resultMeta = document.getElementById("result-meta");
  const downloadBtn = document.getElementById("download-btn");
  const downloadBundleBtn = document.getElementById("download-bundle-btn");

  let selectedFile = null;
  let outputBlob = null;
  let outputName = "base.apk";
  let bundleBlob = null;

  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} b`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} kb`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} mb`;
    return `${(bytes / 1024 ** 3).toFixed(2)} gb`;
  };

  const setStatus = (code, text, state = "") => {
    statusCode.textContent = code;
    statusText.textContent = text;
    statusDot.className = `dot ${state}`.trim();
  };

  const resetOutput = () => {
    outputBlob = null;
    bundleBlob = null;
    outputName = "base.apk";
    result.classList.add("hidden");
    downloadBundleBtn.classList.add("hidden");
  };

  const reset = () => {
    selectedFile = null;
    input.value = "";
    fileRow.classList.add("hidden");
    convertBtn.disabled = true;
    resetOutput();
    setStatus("idle", "waiting for an apkm file");
  };

  const selectFile = (file) => {
    resetOutput();

    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".apkm")) {
      selectedFile = null;
      convertBtn.disabled = true;
      setStatus("error", "please select a .apkm file", "error");
      return;
    }

    if (file.size > MAX_INPUT_BYTES) {
      selectedFile = null;
      convertBtn.disabled = true;
      setStatus("error", "file is larger than 1 gb", "error");
      return;
    }

    selectedFile = file;
    fileName.textContent = file.name;
    fileMeta.textContent = `${formatBytes(file.size)} · ${file.type || "application/octet-stream"}`;
    fileRow.classList.remove("hidden");
    convertBtn.disabled = false;
    setStatus("ready", "file selected", "ready");
  };

  const isApk = (name) => name.toLowerCase().endsWith(".apk");
  const isSplit = (name) => name.toLowerCase().endsWith(".split.apk");

  const safeOutputName = (originalName) => {
    const base = originalName.replace(/\.apkm$/i, "").replace(/[^a-zA-Z0-9._-]+/g, "_");
    return `${base || "converted"}.apk`;
  };

  const makeBundleZip = async (entries) => {
    const zip = new JSZip();
    for (const entry of entries) {
      if (!entry.dir && isApk(entry.name)) {
        zip.file(entry.name.split("/").pop(), await entry.async("blob"));
      }
    }
    return zip.generateAsync({ type: "blob", compression: "STORE" });
  };

  const convert = async () => {
    if (!selectedFile) return;

    convertBtn.disabled = true;
    resetOutput();
    setStatus("read", "reading apkm archive", "active");

    try {
      const zip = await JSZip.loadAsync(selectedFile, {
        checkCRC32: false,
        createFolders: false,
        optimizedBinaryString: false
      });

      const entries = Object.values(zip.files).filter((entry) => !entry.dir);
      const apkEntries = entries.filter((entry) => isApk(entry.name));
      const baseEntry = entries.find((entry) => entry.name.toLowerCase().split("/").pop() === "base.apk");

      if (!apkEntries.length) {
        throw new Error("no apk files found inside the apkm archive");
      }

      if (!baseEntry && apkEntries.length !== 1) {
        throw new Error("no base.apk found; package contains multiple apk files");
      }

      const chosen = baseEntry || apkEntries[0];
      setStatus("extract", `extracting ${chosen.name.split("/").pop()}`, "active");

      const bytes = await chosen.async("uint8array");
      if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
        throw new Error("selected file does not look like a valid apk archive");
      }

      outputBlob = new Blob([bytes], { type: "application/vnd.android.package-archive" });
      outputName = safeOutputName(selectedFile.name);

      const splitEntries = apkEntries.filter((entry) => isSplit(entry.name));
      const regularApkCount = apkEntries.length - splitEntries.length;

      resultTitle.textContent = outputName;
      resultMeta.textContent = `${formatBytes(bytes.length)} · ${apkEntries.length} apk file${apkEntries.length === 1 ? "" : "s"} detected`;
      result.classList.remove("hidden");

      if (splitEntries.length > 0) {
        bundleBlob = await makeBundleZip(apkEntries);
        downloadBundleBtn.classList.remove("hidden");
        setStatus(
          "ready",
          `${splitEntries.length} split apk${splitEntries.length === 1 ? "" : "s"} detected · base.apk extracted`,
          "ready"
        );
        resultMeta.textContent = `${formatBytes(bytes.length)} · ${regularApkCount} base apk · ${splitEntries.length} split apk`;
      } else {
        setStatus("done", "base.apk extracted successfully", "ready");
      }
    } catch (error) {
      console.error(error);
      setStatus("error", error?.message || "conversion failed", "error");
    } finally {
      convertBtn.disabled = !selectedFile;
    }
  };

  const download = (blob, name) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  input.addEventListener("change", () => selectFile(input.files?.[0]));
  clearBtn.addEventListener("click", reset);
  convertBtn.addEventListener("click", convert);
  downloadBtn.addEventListener("click", () => download(outputBlob, outputName));
  downloadBundleBtn.addEventListener("click", () => download(bundleBlob, "apkm-apk-files.zip"));

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      dropzone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      dropzone.classList.remove("dragover");
    });
  });

  dropzone.addEventListener("drop", (event) => {
    selectFile(event.dataTransfer.files?.[0]);
  });

  dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      input.click();
    }
  });
})();
