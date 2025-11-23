/**
 * 專業報價單產生器 - 核心邏輯
 * 功能：資料綁定、即時預覽、版本控制 (LocalStorage)、備份還原
 */

// ----------------------------------------------------------------
// 1. 預設資料樣板 (Templates)
// ----------------------------------------------------------------
const defaultFormDataTemplate = {
  inputQuoteNo:
    "Q" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-01",
  inputProjectName: "新專案",
  inputMyName: "創意設計工作室",
  inputMyTaxId: "12345678",
  inputMyPhone: "0912-345-678",
  inputMyEmail: "service@design.com",
  inputClientName: "甲方程式科技有限公司",
  inputClientTaxId: "87654321",
  inputClientContact: "陳經理",
  inputBankCode: "822",
  inputBankName: "中國信託商業銀行",
  inputBankBranch: "敦南分行",
  inputAccountName: "創意設計工作室 王小明",
  inputAccountNo: "1234-5678-9012",
  inputTerms:
    "1. 付款條件：簽約回傳後支付 30% 訂金，驗收完成後支付 70% 尾款。\n2. 報價有效期：本報價單有效期限為報價日起 15 天。\n3. 修改規範：包含 2 次免費修改 (不含架構大改)，超過次數依工時另計。\n4. 智慧財產權：尾款付清後，產出物之著作財產權歸客戶所有。\n5. 若為個人接案，本報價金額不含扣繳稅額。",
};

const defaultItemsTemplate = [
  {
    name: "形象官網視覺設計",
    spec: "首頁 + 5 內頁 (含 RWD 手機版設計)",
    qty: 1,
    price: 35000,
  },
  {
    name: "前端網頁切版工程",
    spec: "Bootstrap 5 / HTML5 / CSS3 / JS 互動",
    qty: 1,
    price: 28000,
  },
  {
    name: "網站主機代管費 (首年)",
    spec: "含 SSL 憑證安裝、環境設定",
    qty: 1,
    price: 6000,
  },
];

// 全域變數
let items = [];
let currentQuoteId = null;
let quoteIndex = []; // 結構: {id, name, qNo, pName}

// ----------------------------------------------------------------
// 2. 初始化流程 (Initialization)
// ----------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  loadQuoteIndex();

  if (quoteIndex.length === 0) {
    // 若完全無紀錄，建立第一張預設單
    createNewQuote(true);
  } else {
    // 讀取最後一次編輯的 ID
    const lastId = localStorage.getItem("twQuote_currentId");
    const targetId = quoteIndex.find((q) => q.id === lastId)
      ? lastId
      : quoteIndex[0].id;
    loadQuote(targetId);
  }
});

// ----------------------------------------------------------------
// 3. 轉場動畫控制 (UI Transitions)
// ----------------------------------------------------------------
async function performTransition(action) {
  const app = document.getElementById("mainAppContent");
  app.classList.add("switching");
  // 等待 CSS transition 300ms
  await new Promise((resolve) => setTimeout(resolve, 300));

  action(); // 執行傳入的函式

  // 等待 DOM 更新後移除效果
  requestAnimationFrame(() => {
    app.classList.remove("switching");
  });
}

function switchQuoteWithTransition(id) {
  if (id && id !== currentQuoteId) {
    performTransition(() => loadQuote(id));
  }
}

function createNewQuoteWithTransition() {
  performTransition(() => createNewQuote(false));
}

// ----------------------------------------------------------------
// 4. 資料管理邏輯 (Data Management)
// ----------------------------------------------------------------

/**
 * 讀取報價單索引列表
 */
function loadQuoteIndex() {
  const storedIndex = localStorage.getItem("twQuote_index");
  quoteIndex = storedIndex ? JSON.parse(storedIndex) : [];
  updateQuoteCount();
}

/**
 * 儲存報價單索引列表
 */
function saveQuoteIndex() {
  localStorage.setItem("twQuote_index", JSON.stringify(quoteIndex));
  renderQuoteSelector();
  updateQuoteCount();
}

/**
 * 更新版本數量顯示
 */
function updateQuoteCount() {
  document.getElementById(
    "quoteCountBadge"
  ).innerText = `(共 ${quoteIndex.length} 版)`;
}

/**
 * 建立新報價單
 * @param {boolean} isInit - 是否為系統初次初始化
 */
function createNewQuote(isInit = false) {
  const newId = "q_" + Date.now();
  const initQNo = defaultFormDataTemplate.inputQuoteNo;
  const initPName = defaultFormDataTemplate.inputProjectName;

  // 自動生成單號
  let suffix = quoteIndex.length + 1;
  let newQNo = isInit
    ? initQNo
    : "Q" +
      new Date().toISOString().slice(0, 10).replace(/-/g, "") +
      "-" +
      suffix.toString().padStart(2, "0");

  // 若單號重複則遞增，直到唯一
  while (!isInit && checkDuplicate(null, newQNo, null).duplicateQNo) {
    suffix++;
    newQNo =
      "Q" +
      new Date().toISOString().slice(0, 10).replace(/-/g, "") +
      "-" +
      suffix.toString().padStart(2, "0");
  }

  // 自動生成專案名稱
  let basePName = isInit ? initPName : "新專案";
  let newPName = basePName;
  let pCounter = 1;

  // 若專案名稱重複，則自動加數字
  if (!isInit) {
    while (checkDuplicate(null, null, newPName).duplicatePName) {
      pCounter++;
      newPName = `${basePName} ${pCounter}`;
    }
  }

  const newName = `${newQNo} ${newPName}`;

  // 更新索引
  quoteIndex.push({ id: newId, name: newName, qNo: newQNo, pName: newPName });
  saveQuoteIndex();

  // 重置表單並填入新值
  resetFormToDefault(newQNo, newPName);

  currentQuoteId = newId;
  localStorage.setItem("twQuote_currentId", currentQuoteId);

  // 立即儲存檔案實體
  forceSave(newId);

  renderQuoteSelector();
  hideDuplicateWarning();

  // 建立新單據後，強制重新渲染預覽畫面
  renderPreview();
}

/**
 * 讀取特定 ID 的報價單
 */
function loadQuote(id) {
  currentQuoteId = id;
  localStorage.setItem("twQuote_currentId", id);

  const storedData = localStorage.getItem("twQuote_data_" + id);
  if (storedData) {
    const data = JSON.parse(storedData);
    fillForm(data.formData);
    items = data.items || [];
  } else {
    resetFormToDefault(); // 防呆
  }

  renderInputItems();
  renderPreview();
  renderQuoteSelector();
  hideDuplicateWarning();
}

/**
 * 刪除目前報價單
 */
function deleteCurrentQuote() {
  if (!confirm("確定要刪除目前的報價單嗎？此動作無法復原。")) return;

  performTransition(() => {
    localStorage.removeItem("twQuote_data_" + currentQuoteId);
    quoteIndex = quoteIndex.filter((q) => q.id !== currentQuoteId);

    if (quoteIndex.length === 0) {
      saveQuoteIndex();
      createNewQuote(true); // 全刪光後自動重生
    } else {
      saveQuoteIndex();
      loadQuote(quoteIndex[0].id);
    }
  });
}

/**
 * 清除所有資料 (Reset)
 */
function clearAllQuotes() {
  if (
    confirm(
      "警告：這將刪除「所有」報價單紀錄，且無法復原！\n\n您確定要清空所有資料並重置嗎？"
    )
  ) {
    performTransition(() => {
      // 清除索引與設定
      localStorage.removeItem("twQuote_index");
      localStorage.removeItem("twQuote_currentId");

      // 清除所有個別資料
      quoteIndex.forEach((q) =>
        localStorage.removeItem("twQuote_data_" + q.id)
      );

      // 重置
      quoteIndex = [];
      createNewQuote(true);
    });
  }
}

// ----------------------------------------------------------------
// 5. 匯出與匯入功能 (Backup / Restore)
// ----------------------------------------------------------------
function exportData() {
  const exportObj = {
    version: "1.0",
    index: quoteIndex,
    quotes: {},
  };
  quoteIndex.forEach((q) => {
    const data = localStorage.getItem("twQuote_data_" + q.id);
    if (data) exportObj.quotes[q.id] = JSON.parse(data);
  });

  const dataStr = JSON.stringify(exportObj, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `quotations_backup_${new Date()
    .toISOString()
    .slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importData(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported.index || !imported.quotes) throw new Error("格式錯誤");

      if (!confirm("匯入將會「覆蓋」目前的瀏覽器紀錄，確定嗎？")) {
        input.value = "";
        return;
      }

      // 清理舊資料
      localStorage.removeItem("twQuote_index");
      localStorage.removeItem("twQuote_currentId");

      // 重建索引 (相容性處理)
      const cleanIndex = imported.index.map((q) => ({
        id: q.id,
        name: q.name,
        qNo: q.qNo || q.name.split(" ")[0],
        pName: q.pName || q.name.split(" ").slice(1).join(" "),
      }));

      // 寫入 Storage
      localStorage.setItem("twQuote_index", JSON.stringify(cleanIndex));
      for (const [id, data] of Object.entries(imported.quotes)) {
        localStorage.setItem("twQuote_data_" + id, JSON.stringify(data));
      }

      alert("還原成功！");
      location.reload();
    } catch (err) {
      alert("匯入失敗：檔案格式不正確或損毀。");
      console.error(err);
    }
  };
  reader.readAsText(file);
}

// ----------------------------------------------------------------
// 6. 表單與檢查邏輯 (Form Logic)
// ----------------------------------------------------------------

function resetFormToDefault(qNo, pName) {
  fillForm(defaultFormDataTemplate);
  if (qNo) document.getElementById("inputQuoteNo").value = qNo;
  if (pName) document.getElementById("inputProjectName").value = pName;

  // 日期處理
  document.getElementById("inputDate").valueAsDate = new Date();
  const today = new Date();
  const validDate = new Date(today);
  validDate.setDate(today.getDate() + 15);
  document.getElementById("inputValid").valueAsDate = validDate;
  document.getElementById("inputDiscount").value = 0;

  items = JSON.parse(JSON.stringify(defaultItemsTemplate));
  renderInputItems();

  // 重置表單後，必須手動觸發預覽更新，否則右側不會變
  renderPreview();
}

function fillForm(data) {
  if (!data) return;
  for (const [key, value] of Object.entries(data)) {
    const el = document.getElementById(key);
    if (el) {
      if (el.type === "checkbox") el.checked = value;
      else el.value = value;
    }
  }
}

/**
 * 檢查名稱是否重複
 */
function checkDuplicate(currentId, qNo, pName) {
  let dupQNo = false;
  let dupPName = false;

  if (qNo) dupQNo = quoteIndex.some((q) => q.id !== currentId && q.qNo === qNo);
  if (pName)
    dupPName = quoteIndex.some((q) => q.id !== currentId && q.pName === pName);

  return { duplicateQNo: dupQNo, duplicatePName: dupPName };
}

function forceSave(id) {
  const data = collectFormData();
  localStorage.setItem("twQuote_data_" + id, JSON.stringify(data));
}

function collectFormData() {
  const formData = {};
  const inputs = document.querySelectorAll(
    "#quoteForm input, #quoteForm textarea"
  );
  inputs.forEach((input) => {
    if (input.id) {
      if (input.type === "checkbox") formData[input.id] = input.checked;
      else formData[input.id] = input.value;
    }
  });
  return { formData, items };
}

function saveCurrentQuoteData() {
  if (!currentQuoteId) return;

  const qNo = document.getElementById("inputQuoteNo").value.trim() || "無單號";
  const pName =
    document.getElementById("inputProjectName").value.trim() || "無專案名稱";

  // 嚴格重複檢查
  const checkResult = checkDuplicate(currentQuoteId, qNo, pName);

  if (checkResult.duplicateQNo || checkResult.duplicatePName) {
    let msg = "資料重複！無法儲存。";
    if (checkResult.duplicateQNo)
      msg = "「報價單號」已存在於其他報價單，請修改。";
    else if (checkResult.duplicatePName)
      msg = "「專案名稱」已存在於其他報價單，請修改。";

    showDuplicateWarning(msg);
    return; // 暫停儲存
  } else {
    hideDuplicateWarning();
  }

  // 執行儲存
  const data = collectFormData();
  localStorage.setItem("twQuote_data_" + currentQuoteId, JSON.stringify(data));

  // 更新索引名稱
  const displayName = `${qNo} ${pName}`;
  const targetIndex = quoteIndex.findIndex((q) => q.id === currentQuoteId);
  if (targetIndex !== -1) {
    const current = quoteIndex[targetIndex];
    if (
      current.name !== displayName ||
      current.qNo !== qNo ||
      current.pName !== pName
    ) {
      quoteIndex[targetIndex].name = displayName;
      quoteIndex[targetIndex].qNo = qNo;
      quoteIndex[targetIndex].pName = pName;
      saveQuoteIndex();
    }
  }
}

function showDuplicateWarning(msg) {
  const alert = document.getElementById("duplicateAlert");
  document.getElementById("duplicateMsg").innerText = msg;
  alert.style.display = "flex";
}

function hideDuplicateWarning() {
  document.getElementById("duplicateAlert").style.display = "none";
}

// ----------------------------------------------------------------
// 7. UI 渲染 (Rendering)
// ----------------------------------------------------------------

const formatMoney = (amount) =>
  amount.toLocaleString("zh-TW", {
    style: "currency",
    currency: "TWD",
    minimumFractionDigits: 0,
  });

// 監聽所有輸入事件 (Auto-Save)
document.getElementById("quoteForm").addEventListener("input", (e) => {
  renderPreview();
  saveCurrentQuoteData();
});

function renderQuoteSelector() {
  const selector = document.getElementById("quoteSelector");
  selector.innerHTML = "";
  quoteIndex.forEach((q) => {
    const option = document.createElement("option");
    option.value = q.id;
    option.text = q.name;
    if (q.id === currentQuoteId) option.selected = true;
    selector.appendChild(option);
  });
}

function renderInputItems() {
  const container = document.getElementById("itemsContainer");
  container.innerHTML = "";
  items.forEach((item, index) => {
    const html = `
          <div class="card p-3 mb-2 shadow-sm border-0 bg-white input-card-item">
              <div class="d-flex justify-content-between mb-2">
                  <span class="badge bg-secondary">項目 ${index + 1}</span>
                  <button type="button" class="btn btn-sm text-danger p-0" onclick="removeItem(${index})"><i class="fas fa-trash-alt"></i></button>
              </div>
              <div class="row g-2">
                  <div class="col-12"><input type="text" class="form-control form-control-sm" placeholder="項目名稱" value="${
                    item.name
                  }" oninput="updateItem(${index}, 'name', this.value)"></div>
                  <div class="col-12"><input type="text" class="form-control form-control-sm" placeholder="規格描述" value="${
                    item.spec
                  }" oninput="updateItem(${index}, 'spec', this.value)"></div>
                  <div class="col-4"><input type="number" class="form-control form-control-sm" placeholder="數量" value="${
                    item.qty
                  }" oninput="updateItem(${index}, 'qty', this.value)"></div>
                  <div class="col-8"><input type="number" class="form-control form-control-sm" placeholder="單價" value="${
                    item.price
                  }" oninput="updateItem(${index}, 'price', this.value)"></div>
              </div>
          </div>`;
    container.insertAdjacentHTML("beforeend", html);
  });
}

function updateItem(index, key, value) {
  items[index][key] = key === "qty" || key === "price" ? Number(value) : value;
  renderPreview();
  saveCurrentQuoteData();
}

function addItem() {
  items.push({ name: "", spec: "", qty: 1, price: 0 });
  renderInputItems();
  renderPreview();
  saveCurrentQuoteData();

  const container = document.getElementById("itemsContainer");
  const lastItem = container.lastElementChild;
  if (lastItem) {
    lastItem.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function removeItem(index) {
  if (items.length > 1) {
    items.splice(index, 1);
    renderInputItems();
    renderPreview();
    saveCurrentQuoteData();
  } else alert("至少需保留一個項目");
}

function renderPreview() {
  const fieldMap = {
    inputQuoteNo: "dispQuoteNo",
    inputDate: "dispDate",
    inputValid: "dispValid",
    inputProjectName: "dispProjectName",
    inputMyName: "dispMyName",
    inputMyTaxId: "dispMyTaxId",
    inputMyPhone: "dispMyPhone",
    inputMyEmail: "dispMyEmail",
    inputClientName: "dispClientName",
    inputClientTaxId: "dispClientTaxId",
    inputClientContact: "dispClientContact",
    inputClientAddr: "dispClientAddr",
    inputBankCode: "dispBankCode",
    inputBankName: "dispBankName",
    inputBankBranch: "dispBankBranch",
    inputAccountName: "dispAccountName",
    inputAccountNo: "dispAccountNo",
    inputTerms: "dispTerms",
  };

  for (const [inputId, dispId] of Object.entries(fieldMap)) {
    const el = document.getElementById(inputId);
    const target = document.getElementById(dispId);
    if (el && target)
      target.innerText =
        el.value ||
        (inputId === "inputClientAddr" || inputId === "inputBankBranch"
          ? ""
          : "--");
  }

  const tbody = document.getElementById("previewTableBody");
  tbody.innerHTML = "";
  let subtotal = 0;

  items.forEach((item) => {
    const total = item.qty * item.price;
    subtotal += total;
    const tr = `<tr>
          <td><div class="fw-bold text-dark">${
            item.name
          }</div><div class="text-secondary small mt-1">${item.spec}</div></td>
          <td class="text-center">${item.qty}</td>
          <td class="text-end">${formatMoney(item.price)}</td>
          <td class="text-end fw-bold text-dark">${formatMoney(total)}</td>
      </tr>`;
    tbody.insertAdjacentHTML("beforeend", tr);
  });

  const discountInput = document.getElementById("inputDiscount");
  const discount = discountInput ? Number(discountInput.value) : 0;
  const subtotalAfterDiscount = Math.max(0, subtotal - discount);
  const hasTax = document.getElementById("checkTax").checked;
  const tax = hasTax ? Math.round(subtotalAfterDiscount * 0.05) : 0;
  const grandTotal = subtotalAfterDiscount + tax;

  document.getElementById("dispSubtotal").innerText = formatMoney(subtotal);
  const rowDiscount = document.getElementById("rowDiscount");
  if (discount > 0) {
    rowDiscount.style.display = "flex";
    document.getElementById("dispDiscount").innerText =
      "-" + formatMoney(discount);
  } else {
    rowDiscount.style.display = "none";
  }
  document.getElementById("dispTax").innerText = formatMoney(tax);
  document.getElementById("dispGrandTotal").innerText = formatMoney(grandTotal);
  document.getElementById("rowTax").style.display = hasTax ? "flex" : "none";
  document.getElementById("dispTerms").innerText =
    document.getElementById("inputTerms").value;
}
