const RESET_VERSION = "incove-catalogs-empty-inventory-2026-06"
if (localStorage.getItem("appInventoryResetVersion") !== RESET_VERSION) {
  ;["products", "clients", "sales", "creditSales", "quotations", "catalogs"].forEach((key) => localStorage.removeItem(key))
  localStorage.setItem("appInventoryResetVersion", RESET_VERSION)
}

// Inventario inicial vacio: los productos reales se crean en la app y se sincronizan con Neon.
let products = JSON.parse(localStorage.getItem("products")) || []
/*
  {
    code: "P001",
    name: "Martillo",
    category: "Herramientas",
    stock: 15,
    priceSale: 250,
    pricePurchase: 150,
    location: "A1",
    unit: "pza",
    description: "Martillo de acero",
    supplier: "Proveedor A",
    dateEntry: "2024-01-15",
    minStock: 5, // Added minStock
  },
  {
    code: "P002",
    name: "Desarmador",
    category: "Herramientas",
    stock: 25,
    priceSale: 80,
    pricePurchase: 50,
    location: "A2",
    unit: "pza",
    description: "Desarmador de cruz",
    supplier: "Proveedor A",
    dateEntry: "2024-01-15",
    minStock: 10, // Added minStock
  },
  {
    code: "P003",
    name: "Pintura Blanca",
    category: "Pinturas",
    stock: 3,
    priceSale: 450,
    pricePurchase: 300,
    location: "B1",
    unit: "lt",
    description: "Pintura vinílica blanca",
    supplier: "Proveedor B",
    dateEntry: "2024-01-20",
    minStock: 5, // Added minStock
  },
  {
    code: "P004",
    name: "Cemento",
    category: "Construcción",
    stock: 50,
    priceSale: 180,
    pricePurchase: 120,
    location: "C1",
    unit: "kg",
    description: "Cemento gris",
    supplier: "Proveedor C",
    dateEntry: "2024-01-10",
    minStock: 20, // Added minStock
  },
  {
    code: "P005",
    name: "Taladro",
    category: "Herramientas",
    stock: 8,
    priceSale: 1200,
    pricePurchase: 800,
    location: "A3",
    unit: "pza",
    description: "Taladro eléctrico",
    supplier: "Proveedor A",
    dateEntry: "2024-01-18",
    minStock: 5, // Added minStock
  },
]

*/
let clients = JSON.parse(localStorage.getItem("clients")) || []
/*
  {
    id: 1,
    name: "Juan Pérez",
    phone: "555-1234",
    email: "juan@example.com",
    address: "Calle Principal 123",
    totalPurchases: 5000,
  },
  {
    id: 2,
    name: "María García",
    phone: "555-5678",
    email: "maria@example.com",
    address: "Av. Central 456",
    totalPurchases: 3500,
  },
  {
    id: 3,
    name: "Carlos López",
    phone: "555-9012",
    email: "carlos@example.com",
    address: "Calle Secundaria 789",
    totalPurchases: 8200,
  },
]

*/
let sales = JSON.parse(localStorage.getItem("sales")) || []
let creditSales = JSON.parse(localStorage.getItem("creditSales")) || []
let quotations = JSON.parse(localStorage.getItem("quotations")) || []
let catalogs = JSON.parse(localStorage.getItem("catalogs")) || {
  categories: ["Construcción", "Herramientas", "Pinturas", "Eléctrico", "Plomería", "Ferretería general"],
  units: ["Unidad", "Kilogramo", "Libra", "Metro", "Metro cuadrado", "Litro", "Galón", "Bulto", "Caja"],
  locations: ["Bodega", "Mostrador", "Estantería A", "Estantería B", "Patio", "Vitrina"],
  suppliers: [],
}
let saleCarts = JSON.parse(sessionStorage.getItem("saleCarts")) || { 1: [], 2: [] }
let activeSaleTab = Number(sessionStorage.getItem("activeSaleTab")) || 1
let cart = saleCarts[activeSaleTab] || []
let creditCart = []
let quoteCart = []
let currentUser = JSON.parse(sessionStorage.getItem("currentUser")) || null

let showingAllAlerts = false
const API_BASE_URL = ((window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || "").replace(/\/$/, "")
let remoteSyncTimer = null

function getCurrentAppState() {
  return {
    products,
    clients,
    sales,
    creditSales,
    quotations,
    catalogs,
  }
}

function applyAppState(state) {
  if (!state || typeof state !== "object") return
  if (Array.isArray(state.products)) products = state.products
  if (Array.isArray(state.clients)) clients = state.clients
  if (Array.isArray(state.sales)) sales = state.sales
  if (Array.isArray(state.creditSales)) creditSales = state.creditSales
  if (Array.isArray(state.quotations)) quotations = state.quotations
  if (state.catalogs && typeof state.catalogs === "object") catalogs = normalizeCatalogs(state.catalogs)
}

async function loadFromApi() {
  if (!API_BASE_URL) return

  try {
    const response = await fetch(`${API_BASE_URL}/api/state`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const payload = await response.json()
    if (payload && payload.data) {
      applyAppState(payload.data)
      localStorage.setItem("products", JSON.stringify(products))
      localStorage.setItem("clients", JSON.stringify(clients))
      localStorage.setItem("sales", JSON.stringify(sales))
      localStorage.setItem("creditSales", JSON.stringify(creditSales))
      localStorage.setItem("quotations", JSON.stringify(quotations))
      localStorage.setItem("catalogs", JSON.stringify(catalogs))
      console.log("[api] Datos cargados desde Neon")
    }
  } catch (error) {
    console.warn("[api] No se pudo cargar desde Neon. Se usaran datos locales.", error)
  }
}

function saveToApiSoon() {
  if (!API_BASE_URL) return

  window.clearTimeout(remoteSyncTimer)
  remoteSyncTimer = window.setTimeout(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/state`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: getCurrentAppState() }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      console.log("[api] Datos sincronizados con Neon")
    } catch (error) {
      console.warn("[api] No se pudo sincronizar con Neon. Los datos quedan en localStorage.", error)
    }
  }, 500)
}

function saveToStorage() {
  saleCarts[activeSaleTab] = cart
  localStorage.setItem("products", JSON.stringify(products))
  localStorage.setItem("clients", JSON.stringify(clients))
  localStorage.setItem("sales", JSON.stringify(sales))
  localStorage.setItem("creditSales", JSON.stringify(creditSales))
  localStorage.setItem("quotations", JSON.stringify(quotations))
  localStorage.setItem("catalogs", JSON.stringify(catalogs))
  sessionStorage.setItem("cart", JSON.stringify(cart))
  sessionStorage.setItem("saleCarts", JSON.stringify(saleCarts))
  sessionStorage.setItem("activeSaleTab", activeSaleTab.toString())
  if (currentUser) {
    sessionStorage.setItem("currentUser", JSON.stringify(currentUser))
  }
  saveToApiSoon()
  console.log("[v0] Data saved to storage")
}

function exportData() {
  const dataToExport = {
    products: products,
    clients: clients,
    sales: sales,
    creditSales: creditSales,
    quotations: quotations,
    catalogs: catalogs,
    exportDate: new Date().toISOString(),
    version: "1.0",
  }

  const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `incove-backup-${new Date().toISOString().split("T")[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
  alert("Datos exportados exitosamente")
}

function importData(file) {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result)
      if (data.products) products = data.products
      if (data.clients) clients = data.clients
      if (data.sales) sales = data.sales
      if (data.creditSales) creditSales = data.creditSales
      if (data.quotations) quotations = data.quotations
      if (data.catalogs) catalogs = normalizeCatalogs(data.catalogs)
      saveToStorage()
      alert("Datos importados exitosamente")
      location.reload()
    } catch (error) {
      alert("Error al importar datos: " + error.message)
    }
  }
  reader.readAsText(file)
}

window.addEventListener("DOMContentLoaded", async () => {
  await loadFromApi()

  if (currentUser) {
    const userName = document.getElementById("user-name")
    if (userName) userName.textContent = currentUser.name
    document.getElementById("login-section").classList.add("hidden")
    document.getElementById("app-section").classList.add("active")
    showSection("dashboard")
    loadDashboard()
  }
})

// Login
document.getElementById("login-form").addEventListener("submit", (e) => {
  e.preventDefault()
  const username = document.getElementById("username").value
  const password = document.getElementById("password").value

  // Validación simple (en producción usar autenticación real)
  if (username === "ferreteriaincove" && password === "Milalito23*") {
    currentUser = { name: "INCOVE", role: "Administrador" }
    document.getElementById("user-name").textContent = currentUser.name

    // Completely hide login section
    document.getElementById("login-section").classList.add("hidden")

    // Show initial balance modal
    const modal = document.getElementById("initial-balance-modal")
    modal.classList.add("active")
    modal.style.display = "flex"
  } else {
    alert("Usuario o contraseña incorrectos")
  }
})

function confirmInitialBalance() {
  const rawInitialBalance = document.getElementById("initial-balance").value
  const initialBalance = rawInitialBalance === "" ? 0 : Number.parseFloat(rawInitialBalance)

  if (Number.isNaN(initialBalance) || initialBalance < 0) {
    alert("El saldo inicial no puede ser negativo")
    return
  }

  // Save initial balance to localStorage
  const todayDate = new Date().toDateString()
  localStorage.setItem("initialBalance", initialBalance.toString())
  localStorage.setItem("initialBalanceDate", todayDate)

  document.getElementById("initial-balance-modal").style.display = "none"
  document.getElementById("initial-balance-modal").classList.remove("active")
  document.getElementById("app-section").classList.add("active")
  showSection("dashboard")

  saveToStorage()
  loadDashboard()
}

function importDataOnStartup(event) {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result)

      if (data.products || data.clients || data.sales || data.creditSales || data.quotations || data.catalogs) {
        if (data.products) products = data.products
        if (data.clients) clients = data.clients
        if (data.sales) sales = data.sales
        if (data.creditSales) creditSales = data.creditSales
        if (data.quotations) quotations = data.quotations
        if (data.catalogs) catalogs = normalizeCatalogs(data.catalogs)

        saveToStorage()

        const statusEl = document.getElementById("import-status")
        statusEl.textContent = `Importado correctamente: ${products.length} productos, ${clients.length} clientes, ${sales.length} ventas`
        statusEl.style.color = "var(--success)"

        setTimeout(() => {
          statusEl.textContent = ""
        }, 5000)
      } else {
        alert("El archivo no tiene el formato correcto")
      }
    } catch (error) {
      alert("Error al leer el archivo: " + error.message)
    }
  }
  reader.readAsText(file)
}

// Logout
function logout() {
  if (confirm("¿Estás seguro de cerrar sesión?")) {
    currentUser = null
    cart = []
    saleCarts = { 1: [], 2: [] }
    activeSaleTab = 1
    creditCart = []
    sessionStorage.removeItem("currentUser")
    sessionStorage.removeItem("cart")
    sessionStorage.removeItem("saleCarts")
    sessionStorage.removeItem("activeSaleTab")
    document.getElementById("initial-balance").value = ""
    document.getElementById("app-section").classList.remove("active")
    document.getElementById("login-section").classList.remove("hidden")
    document.getElementById("login-section").classList.add("active")
    document.getElementById("username").value = ""
    document.getElementById("password").value = ""
  }
}

// Navigation
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", function () {
    const module = this.dataset.module
    switchModule(module)
  })
})

function switchModule(module) {
  // Actualizar botones de navegación
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.remove("active")
    if (btn.dataset.module === module) {
      btn.classList.add("active")
    }
  })

  // Mostrar módulo correspondiente
  document.querySelectorAll(".module").forEach((mod) => {
    mod.classList.remove("active")
  })
  document.getElementById(`${module}-module`).classList.add("active")

  // Cargar datos del módulo
  switch (module) {
    case "dashboard":
      loadDashboard()
      break
    case "pos":
      loadPOS()
      break
    case "inventory":
      loadInventory()
      break
    case "clients":
      loadClients()
      break
    case "quotes":
      loadQuotes()
      break
    case "credits":
      loadCredits()
      break
    case "reports":
      loadReports()
      break
    case "close-register":
      loadCloseRegister()
      break
  }
}

// Dashboard
function loadDashboard() {
  const dailySales = sales.reduce((sum, sale) => sum + sale.total, 0)
  const dailyTransactions = sales.length
  const dailyProfit = sales.reduce((sum, sale) => {
    return (
      sum +
      sale.items.reduce((itemSum, item) => {
        const product = products.find((p) => p.code === item.code)
        if (product) {
          return itemSum + (item.price - product.pricePurchase) * item.quantity
        }
        return itemSum
      }, 0)
    )
  }, 0)

  document.getElementById("daily-sales").textContent = dailySales.toFixed(2)
  document.getElementById("daily-transactions").textContent = dailyTransactions
  document.getElementById("daily-profit").textContent = dailyProfit.toFixed(2)

  // Llamar a la nueva función loadAlerts
  loadAlerts()
}

// POS (Punto de Venta)
function loadPOS() {
  loadClientSelect()
  syncActiveCart()
  renderSaleTabs()
  renderCart()
  setupProductSearch()
}

function syncActiveCart() {
  saleCarts[activeSaleTab] = saleCarts[activeSaleTab] || []
  cart = saleCarts[activeSaleTab]
}

function renderSaleTabs() {
  document.querySelectorAll(".sale-tab").forEach((button) => {
    const tab = Number(button.id.replace("sale-tab-", ""))
    const count = (saleCarts[tab] || []).length
    button.classList.toggle("active", tab === activeSaleTab)
    button.textContent = `Venta ${tab}${count ? ` (${count})` : ""}`
  })
}

function switchSaleTab(tabNumber) {
  saleCarts[activeSaleTab] = cart
  activeSaleTab = tabNumber
  syncActiveCart()
  renderSaleTabs()
  renderCart()
  saveToStorage()
}

function setupProductSearch() {
  const searchInput = document.getElementById("product-search")
  const searchResults = document.getElementById("search-results")

  searchInput.addEventListener("input", function () {
    const query = this.value.toLowerCase()

    if (query.length < 2) {
      searchResults.classList.remove("active")
      return
    }

    const results = products.filter((p) => p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query))

    if (results.length > 0) {
      searchResults.innerHTML = results
        .map(
          (p) =>
            `<div class="search-result-item" onclick="addToCart('${p.code}')">
                    <strong>${p.name}</strong> (${p.code}) - $${p.priceSale} - Stock: ${p.stock}
                </div>`,
        )
        .join("")
      searchResults.classList.add("active")
    } else {
      searchResults.innerHTML = '<div class="search-result-item">No se encontraron productos</div>'
      searchResults.classList.add("active")
    }
  })
}

async function scanBarcode() {
  if (!("BarcodeDetector" in window)) {
    return prompt("Tu navegador no permite escaneo directo. Escribe el codigo de barras:")
  }

  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.capture = "environment"
    input.onchange = async () => {
      try {
        const file = input.files[0]
        if (!file) {
          resolve("")
          return
        }

        const bitmap = await createImageBitmap(file)
        const detector = new BarcodeDetector({
          formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e"],
        })
        const codes = await detector.detect(bitmap)
        resolve(codes[0] ? codes[0].rawValue : prompt("No se detecto codigo. Escribelo manualmente:"))
      } catch (error) {
        console.warn("No se pudo escanear el codigo", error)
        resolve(prompt("No se pudo escanear. Escribe el codigo manualmente:"))
      }
    }
    input.click()
  })
}

async function scanBarcodeForSale() {
  const code = await scanBarcode()
  if (!code) return
  const product = products.find((p) => p.code === code)
  if (product) {
    addToCart(product.code)
  } else {
    document.getElementById("product-search").value = code
    alert("Producto no encontrado. Puedes crearlo en Inventario con ese codigo.")
  }
}

async function scanBarcodeForProduct() {
  const code = await scanBarcode()
  if (code) document.getElementById("product-code").value = code
}

function addToCart(productCode) {
  const product = products.find((p) => p.code === productCode)

  if (!product) {
    alert("Producto no encontrado")
    return
  }

  if (product.stock <= 0) {
    alert("Producto sin stock")
    return
  }

  const existingItem = cart.find((item) => item.code === productCode)

  if (existingItem) {
    if (existingItem.quantity < product.stock) {
      existingItem.quantity++
    } else {
      alert("No hay suficiente stock")
      return
    }
  } else {
    cart.push({
      code: product.code,
      name: product.name,
      price: product.priceSale,
      taxRate: Number(product.taxRate ?? 0.19),
      quantity: 1,
    })
  }

  renderCart()
  saveToStorage()
  document.getElementById("product-search").value = ""
  document.getElementById("search-results").classList.remove("active")
}

function removeFromCart(productCode) {
  cart = cart.filter((item) => item.code !== productCode)
  renderCart()
  saveToStorage()
}

function updateCartQuantity(productCode, quantity) {
  const product = products.find((p) => p.code === productCode)
  const item = cart.find((item) => item.code === productCode)

  if (quantity <= 0) {
    removeFromCart(productCode)
    return
  }

  if (quantity > product.stock) {
    alert("No hay suficiente stock")
    return
  }

  item.quantity = quantity
  renderCart()
  saveToStorage()
}

function calculateCartTotals(items = cart) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = items.reduce((sum, item) => {
    const rate = Number(item.taxRate ?? 0.19)
    const lineTotal = item.price * item.quantity
    return sum + (rate > 0 ? lineTotal - lineTotal / (1 + rate) : 0)
  }, 0)

  return {
    subtotal: total - tax,
    tax,
    total,
  }
}

function renderCart() {
  const cartTableBody = document.getElementById("cart-items")
  renderSaleTabs()

  if (cart.length === 0) {
    cartTableBody.innerHTML = '<tr class="empty-cart"><td colspan="5">No hay productos en el carrito</td></tr>'
    updateTotals()
    return
  }

  cartTableBody.innerHTML = cart
    .map((item) => {
      const subtotal = item.price * item.quantity
      return `
            <tr>
                <td>${item.name}</td>
                <td>$${item.price.toFixed(2)}</td>
                <td>
                    <input type="number" value="${item.quantity}" min="1"
                           onchange="updateCartQuantity('${item.code}', Number.parseFloat(this.value))">
                </td>
                <td>$${subtotal.toFixed(2)}</td>
                <td>
                    <button class="btn-remove" onclick="removeFromCart('${item.code}')">Eliminar</button>
                </td>
            </tr>
        `
    })
    .join("")

  updateTotals()
}

function updateTotals() {
  const { subtotal, tax, total } = calculateCartTotals()

  document.getElementById("cart-subtotal").textContent = subtotal.toFixed(2)
  document.getElementById("cart-tax").textContent = tax.toFixed(2)
  document.getElementById("cart-total").textContent = total.toFixed(2)
  document.getElementById("amount-paid").dispatchEvent(new Event("input"))
}

function loadClientSelect() {
  const clientSelect = document.getElementById("client-select")
  clientSelect.innerHTML =
    '<option value="">Cliente General</option>' +
    clients.map((c) => `<option value="${c.id}">${c.name}</option>`).join("")
}

// Calcular cambio
document.getElementById("amount-paid").addEventListener("input", function () {
  const total = Number.parseFloat(document.getElementById("cart-total").textContent)
  const paid = Number.parseFloat(this.value) || 0
  const change = paid - total

  document.getElementById("change-amount").textContent = Math.max(0, change).toFixed(2)
})

function updateCartDisplay() {
  const tbody = document.getElementById("cart-items")

  if (cart.length === 0) {
    tbody.innerHTML = '<tr class="empty-cart"><td colspan="5">No hay productos en el carrito</td></tr>'
    document.getElementById("cart-subtotal").textContent = "0.00"
    document.getElementById("cart-tax").textContent = "0.00"
    document.getElementById("cart-total").textContent = "0.00"
    return
  }

  tbody.innerHTML = cart
    .map(
      (item) => `
        <tr>
            <td>${item.name}</td>
            <td>$${item.price.toFixed(2)}</td>
            <td>
                <input type="number"
                       value="${item.quantity}"
                       min="0.01"
                       step="0.01"
                       onchange="updateCartQuantity('${item.code}', Number.parseFloat(this.value))"
                       style="width: 80px; padding: 0.25rem;">
            </td>
            <td>$${(item.price * item.quantity).toFixed(2)}</td>
            <td>
                <button onclick="removeFromCart('${item.code}')" class="btn-icon btn-danger">🗑️</button>
            </td>
        </tr>
    `,
    )
    .join("")

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = subtotal * 0.19 // 19% IVA (informational only, not added to total)
  const total = subtotal // Total is just subtotal, tax is only shown for info

  document.getElementById("cart-subtotal").textContent = subtotal.toFixed(2)
  document.getElementById("cart-tax").textContent = tax.toFixed(2)
  document.getElementById("cart-total").textContent = total.toFixed(2)
}

function setQuickAmount(amount) {
  const total = Number.parseFloat(document.getElementById("cart-total").textContent)
  const amountInput = document.getElementById("amount-paid")

  if (amount === "exact") {
    amountInput.value = total.toFixed(2)
  } else {
    amountInput.value = amount.toFixed(2)
  }

  // Trigger change event to update change display
  amountInput.dispatchEvent(new Event("input"))
}

function toggleInvoiceFields() {
  const checkbox = document.getElementById("print-invoice")
  const fields = document.getElementById("invoice-fields")
  fields.style.display = checkbox.checked ? "block" : "none"
}

function completeSale() {
  if (cart.length === 0) {
    alert("El carrito está vacío")
    return
  }

  const { subtotal, tax, total } = calculateCartTotals()
  const paymentMethod = document.getElementById("payment-method").value
  const amountPaid = Number.parseFloat(document.getElementById("amount-paid").value) || 0

  if (paymentMethod === "fiado") {
    completeCartAsFiado(subtotal, tax, total)
    return
  }

  if (paymentMethod === "cash" && amountPaid < total) {
    alert("El monto pagado es insuficiente")
    return
  }

  // Check if invoice is requested
  const printInvoice = document.getElementById("print-invoice").checked
  let invoiceData = null

  if (printInvoice) {
    const invoiceName = document.getElementById("invoice-name").value.trim()
    if (!invoiceName) {
      alert("Debe ingresar el nombre del cliente para imprimir la factura")
      return
    }

    invoiceData = {
      name: invoiceName,
      address: document.getElementById("invoice-address").value.trim(),
      city: document.getElementById("invoice-city").value.trim(),
    }
  }

  // Registrar venta
  const sale = {
    id: sales.length + 1,
    date: new Date().toISOString(),
    items: [...cart],
    subtotal: subtotal,
    tax: tax,
    total: total,
    paymentMethod: paymentMethod,
    amountPaid: paymentMethod === "cash" ? amountPaid : total,
    change: paymentMethod === "cash" ? Math.max(0, amountPaid - total) : 0,
    clientId: document.getElementById("client-select").value,
    invoice: invoiceData,
  }

  sales.push(sale)

  // Actualizar stock
  cart.forEach((item) => {
    const product = products.find((p) => p.code === item.code)
    if (product) {
      product.stock -= item.quantity
    }
  })

  // Actualizar cliente
  if (sale.clientId) {
    const client = clients.find((c) => c.id == sale.clientId)
    if (client) {
      client.totalPurchases += total
    }
  }

  saveToStorage()

  // Print invoice if requested
  if (printInvoice && invoiceData) {
    printInvoiceWindow(sale, invoiceData)
  }

  const lowStockAfterSale = products.filter((p) => p.stock <= (p.minStock || 5))
  const stockMessage = lowStockAfterSale.length
    ? `\n\nProductos por surtir:\n${lowStockAfterSale.map((p) => `- ${p.name}: ${p.stock} ${p.unit || ""}`).join("\n")}`
    : ""

  alert(`Venta completada!\nTotal: $${total.toFixed(2)}\nCambio: $${sale.change.toFixed(2)}${stockMessage}`)

  clearCart()

  // Reset invoice form
  document.getElementById("print-invoice").checked = false
  document.getElementById("invoice-name").value = ""
  document.getElementById("invoice-address").value = ""
  document.getElementById("invoice-city").value = ""
  toggleInvoiceFields()
}

function completeCartAsFiado(subtotal, tax, total) {
  if (cart.length === 0) {
    alert("El carrito esta vacio")
    return
  }

  let clientId = document.getElementById("client-select").value
  let client = clientId ? clients.find((c) => c.id == clientId) : null

  if (!client) {
    const name = prompt("Nombre y apellido del cliente para fiar:")
    if (!name || !name.trim()) return
    const phone = prompt("Numero celular del cliente:")
    if (!phone || !phone.trim()) {
      alert("El celular es obligatorio para registrar un fiado.")
      return
    }

    client = {
      id: clients.length > 0 ? Math.max(...clients.map((c) => c.id)) + 1 : 1,
      name: name.trim(),
      phone: phone.trim(),
      email: "",
      address: "",
      totalPurchases: 0,
    }
    clients.push(client)
    clientId = client.id
  }

  creditSales.push({
    id: creditSales.length + 1,
    date: new Date().toISOString(),
    clientId: Number.parseInt(clientId),
    clientName: client.name,
    clientPhone: client.phone,
    items: [...cart],
    subtotal,
    tax,
    total,
    paid: false,
    paymentDate: null,
    source: "pos",
  })

  cart.forEach((item) => {
    const product = products.find((p) => p.code === item.code)
    if (product) product.stock -= item.quantity
  })

  saveToStorage()
  alert(`Fiado registrado!\nCliente: ${client.name}\nTotal: $${total.toFixed(2)}`)
  populateCreditClientSelect()
  clearCart()
}

function buildBusinessDocumentHtml({
  title,
  documentLabel,
  numberLabel,
  number,
  date,
  clientName,
  clientPhone = "",
  validUntil = "",
  items,
  subtotal,
  tax,
  total,
  footer,
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 820px; margin: 20px auto; padding: 20px; color: #111827; }
        .header { border-bottom: 3px solid #0f766e; padding-bottom: 14px; margin-bottom: 20px; }
        .header h1 { margin: 0; color: #0f766e; font-size: 28px; }
        .header p { margin: 4px 0; color: #374151; }
        .info-row { display: flex; justify-content: space-between; gap: 1rem; margin: 7px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #d1d5db; padding: 9px; text-align: left; }
        th { background: #f3f4f6; }
        .totals { margin-left: auto; width: 300px; }
        .total-line { display: flex; justify-content: space-between; margin: 7px 0; }
        .total-final { border-top: 2px solid #0f766e; padding-top: 8px; font-size: 18px; font-weight: 700; }
        .footer { border-top: 1px solid #d1d5db; color: #4b5563; margin-top: 24px; padding-top: 12px; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>INCOVE</h1>
        <p><strong>Ingeniería y Construcciones Venecia</strong></p>
        <p>${documentLabel}</p>
      </div>
      <div class="info-row"><strong>${numberLabel}</strong><span>#${number}</span></div>
      <div class="info-row"><strong>Fecha:</strong><span>${new Date(date).toLocaleString("es-CO")}</span></div>
      ${validUntil ? `<div class="info-row"><strong>Válida hasta:</strong><span>${validUntil}</span></div>` : ""}
      <div class="info-row"><strong>Cliente:</strong><span>${clientName}</span></div>
      ${clientPhone ? `<div class="info-row"><strong>Celular:</strong><span>${clientPhone}</span></div>` : ""}
      <table>
        <thead>
          <tr><th>Item</th><th>Producto</th><th>Cantidad</th><th>Vr. Unitario</th><th>Total</th></tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${item.name}</td>
              <td>${item.quantity}</td>
              <td>$${Number(item.price || 0).toFixed(2)}</td>
              <td>$${(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}</td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>
      <div class="totals">
        <div class="total-line"><span>Subtotal sin IVA:</span><strong>$${subtotal.toFixed(2)}</strong></div>
        <div class="total-line"><span>IVA:</span><strong>$${tax.toFixed(2)}</strong></div>
        <div class="total-line total-final"><span>Total:</span><strong>$${total.toFixed(2)}</strong></div>
      </div>
      <div class="footer">${footer}</div>
      <script>window.onload = function(){ window.print(); }</script>
    </body>
    </html>
  `
}

function printInvoiceWindow(sale, invoiceData) {
  const subtotal = typeof sale.subtotal === "number" ? sale.subtotal : sale.total - (sale.tax || 0)
  const tax = sale.tax || 0
  const currentDate = new Date(sale.date).toLocaleString("es-CO")

  const invoiceHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Factura #${sale.id}</title>
      <style>
        body {
          font-family: 'Courier New', monospace;
          max-width: 800px;
          margin: 20px auto;
          padding: 20px;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
        }
        .info-section {
          margin-bottom: 20px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin: 5px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        th, td {
          border: 1px solid #000;
          padding: 8px;
          text-align: left;
        }
        th {
          background-color: #f0f0f0;
        }
        .totals {
          margin-top: 20px;
          text-align: right;
        }
        .totals div {
          margin: 5px 0;
        }
        .total-final {
          font-size: 18px;
          font-weight: bold;
          border-top: 2px solid #000;
          padding-top: 10px;
          margin-top: 10px;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          border-top: 2px solid #000;
          padding-top: 10px;
        }
        @media print {
          body {
            margin: 0;
            padding: 10px;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>INCOVE</h1>
        <p>Ingeniería y Construcciones Venecia</p>
        <p>FACTURA DE VENTA</p>
      </div>

      <div class="info-section">
        <div class="info-row">
          <strong>Factura No:</strong>
          <span>#${sale.id}</span>
        </div>
        <div class="info-row">
          <strong>Fecha:</strong>
          <span>${currentDate}</span>
        </div>
        <div class="info-row">
          <strong>Método de Pago:</strong>
          <span>${sale.paymentMethod === "cash" ? "Efectivo" : sale.paymentMethod === "card" ? "Tarjeta" : "Transferencia"}</span>
        </div>
      </div>

      <div class="info-section">
        <h3>DATOS DEL CLIENTE</h3>
        <div class="info-row">
          <strong>Nombre:</strong>
          <span>${invoiceData.name}</span>
        </div>
        ${
          invoiceData.address
            ? `
        <div class="info-row">
          <strong>Dirección:</strong>
          <span>${invoiceData.address}</span>
        </div>
        `
            : ""
        }
        ${
          invoiceData.city
            ? `
        <div class="info-row">
          <strong>Ciudad:</strong>
          <span>${invoiceData.city}</span>
        </div>
        `
            : ""
        }
      </div>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Descripción</th>
            <th>Cantidad</th>
            <th>Vr. Unitario</th>
            <th>Valor Total</th>
          </tr>
        </thead>
        <tbody>
          ${sale.items
            .map(
              (item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${item.name}</td>
              <td>${item.quantity}</td>
              <td>$${item.price.toFixed(2)}</td>
              <td>$${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>

      <div class="totals">
        <div>
          <strong>Subtotal:</strong> $${subtotal.toFixed(2)}
        </div>
        <div>
          <strong>IVA (19%):</strong> $${tax.toFixed(2)}
        </div>
        <div class="total-final">
          <strong>TOTAL:</strong> $${sale.total.toFixed(2)}
        </div>
      </div>

      <div class="footer">
        <p>Gracias por su compra</p>
        <p>Este documento es una factura de venta</p>
      </div>

      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `

  const printWindow = window.open("", "_blank")
  printWindow.document.write(invoiceHTML)
  printWindow.document.close()
}

function clearCart() {
  cart = []
  saleCarts[activeSaleTab] = cart
  renderCart()
  document.getElementById("amount-paid").value = ""
  document.getElementById("change-amount").textContent = "0.00"
  document.getElementById("client-select").value = ""
  saveToStorage()
}

// Inventario
function loadInventory() {
  renderInventoryTable()
  loadCategoryFilter()
  setupInventorySearch()
}

function productRowHtml(p) {
  const minStock = p.minStock || 5
  const isLowStock = p.stock <= minStock
  const reorderQty = isLowStock ? Math.max(minStock * 2 - p.stock, minStock - p.stock) : 0
  const image = p.image
    ? `<img class="product-thumb" src="${p.image}" alt="${p.name}">`
    : `<span class="product-thumb empty">Sin foto</span>`

  return `
    <tr class="${isLowStock ? "low-stock-row" : ""}">
        <td>${image}</td>
        <td>${p.code}</td>
        <td>${p.name}</td>
        <td>${p.category || ""}</td>
        <td style="color: ${isLowStock ? "var(--danger)" : "inherit"}; font-weight: ${isLowStock ? "bold" : "normal"}">
            ${p.stock} ${p.unit || ""}
        </td>
        <td>${minStock}</td>
        <td>$${Number(p.priceSale || 0).toFixed(2)}</td>
        <td>$${Number(p.pricePurchase || 0).toFixed(2)}</td>
        <td>${p.location || ""}</td>
        <td>${p.supplier || ""}</td>
        <td>${reorderQty > 0 ? `${reorderQty} ${p.unit || ""}` : "OK"}</td>
        <td>
            <button class="btn btn-secondary" onclick="editProduct('${p.code}')">Editar</button>
            <button class="btn btn-secondary" onclick="deleteProduct('${p.code}')">Eliminar</button>
        </td>
    </tr>
  `
}

function renderInventoryTable() {
  const tbody = document.getElementById("inventory-table-body")
  tbody.innerHTML = products.map(productRowHtml).join("")
}

function loadCategoryFilter() {
  seedCatalogsFromProducts()
  const categories = [...new Set([...(catalogs.categories || []), ...products.map((p) => p.category)].filter(Boolean))]
  const select = document.getElementById("category-filter")
  select.innerHTML =
    '<option value="">Todas las Categorías</option>' +
    categories.map((c) => `<option value="${c}">${c}</option>`).join("")

  select.addEventListener("change", filterInventory)
}

function setupInventorySearch() {
  document.getElementById("inventory-search").addEventListener("input", filterInventory)
}

function filterInventory() {
  const searchTerm = document.getElementById("inventory-search").value.toLowerCase()
  const category = document.getElementById("category-filter").value

  const filtered = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm) || p.code.toLowerCase().includes(searchTerm)
    const matchesCategory = !category || p.category === category
    return matchesSearch && matchesCategory
  })

  const tbody = document.getElementById("inventory-table-body")
  tbody.innerHTML = filtered.map(productRowHtml).join("")
}

function normalizeCatalogs(source) {
  const defaults = {
    categories: [],
    units: [],
    locations: [],
    suppliers: [],
  }
  const normalized = { ...defaults, ...source }
  normalized.categories = [...new Set((normalized.categories || []).filter(Boolean))]
  normalized.units = [...new Set((normalized.units || []).filter(Boolean))]
  normalized.locations = [...new Set((normalized.locations || []).filter(Boolean))]
  normalized.suppliers = (normalized.suppliers || []).map((supplier) =>
    typeof supplier === "string" ? { name: supplier, nit: "", phone: "", contact: "" } : supplier,
  )
  return normalized
}

function seedCatalogsFromProducts() {
  products.forEach((product) => {
    addCatalogValue("categories", product.category, false)
    addCatalogValue("units", product.unit, false)
    addCatalogValue("locations", product.location, false)
    addCatalogValue("suppliers", product.supplier, false)
  })
}

function getCatalogLabel(type, item) {
  if (!item) return ""
  return type === "suppliers" && typeof item === "object" ? item.name : item
}

function addCatalogValue(type, value, persist = true) {
  if (!value) return ""
  catalogs = normalizeCatalogs(catalogs)

  if (type === "suppliers") {
    const supplier = typeof value === "object" ? value : { name: value, nit: "", phone: "", contact: "" }
    const exists = catalogs.suppliers.some((item) => item.name.toLowerCase() === supplier.name.toLowerCase())
    if (!exists) catalogs.suppliers.push(supplier)
    if (persist) saveToStorage()
    return supplier.name
  }

  const exists = catalogs[type].some((item) => item.toLowerCase() === value.toLowerCase())
  if (!exists) catalogs[type].push(value)
  if (persist) saveToStorage()
  return value
}

function renderCatalogSelect(selectId, type, selectedValue = "") {
  const select = document.getElementById(selectId)
  if (!select) return
  catalogs = normalizeCatalogs(catalogs)

  const options = catalogs[type]
    .map((item) => {
      const label = getCatalogLabel(type, item)
      return `<option value="${label}">${label}</option>`
    })
    .join("")

  select.innerHTML = `<option value="">Seleccionar...</option>${options}<option value="__add_new__">+ Agregar nueva opción</option>`
  if (selectedValue) select.value = selectedValue
}

function renderProductCatalogSelects(product = {}) {
  seedCatalogsFromProducts()
  renderCatalogSelect("product-category", "categories", product.category || "")
  renderCatalogSelect("product-unit", "units", product.unit || "")
  renderCatalogSelect("product-location", "locations", product.location || "")
  renderCatalogSelect("product-supplier", "suppliers", product.supplier || "")
}

function handleCatalogSelect(type, selectId) {
  const select = document.getElementById(selectId)
  if (select.value !== "__add_new__") return

  let newValue = ""
  if (type === "suppliers") {
    const name = prompt("Nombre legal del proveedor:")
    if (!name || !name.trim()) {
      select.value = ""
      return
    }
    const nit = prompt("NIT del proveedor (opcional):") || ""
    const phone = prompt("Teléfono del proveedor (opcional):") || ""
    const contact = prompt("Persona de contacto (opcional):") || ""
    newValue = addCatalogValue(type, { name: name.trim(), nit: nit.trim(), phone: phone.trim(), contact: contact.trim() })
  } else if (type === "locations") {
    const name = prompt("Nombre de la ubicación. Ejemplo: Bodega cemento, Estantería A3, Patio:")
    if (!name || !name.trim()) {
      select.value = ""
      return
    }
    newValue = addCatalogValue(type, name.trim())
  } else {
    const label = type === "categories" ? "Nombre de la categoría:" : "Nombre de la unidad de medida:"
    const name = prompt(label)
    if (!name || !name.trim()) {
      select.value = ""
      return
    }
    newValue = addCatalogValue(type, name.trim())
  }

  renderProductCatalogSelects({
    category: document.getElementById("product-category").value,
    unit: document.getElementById("product-unit").value,
    location: document.getElementById("product-location").value,
    supplier: document.getElementById("product-supplier").value,
  })
  select.value = newValue
}

function showAddProductModal() {
  document.getElementById("product-modal-title").textContent = "Agregar Producto"
  document.getElementById("product-form").reset()
  document.getElementById("product-tax-rate").value = "0.19"
  document.getElementById("product-photo-preview").innerHTML = ""
  renderProductCatalogSelects()
  document.getElementById("product-modal").classList.add("active")
}

function closeProductModal() {
  document.getElementById("product-modal").classList.remove("active")
}

function editProduct(code) {
  const product = products.find((p) => p.code === code)
  if (!product) return

  document.getElementById("product-modal-title").textContent = "Editar Producto"
  renderProductCatalogSelects(product)
  document.getElementById("product-code").value = product.code
  document.getElementById("product-name").value = product.name
  document.getElementById("product-category").value = product.category
  document.getElementById("product-stock").value = product.stock
  document.getElementById("product-min-stock").value = product.minStock || 5 // Populate minStock field
  document.getElementById("product-price-sale").value = product.priceSale
  document.getElementById("product-price-purchase").value = product.pricePurchase
  document.getElementById("product-tax-rate").value = String(product.taxRate ?? 0.19)
  document.getElementById("product-location").value = product.location
  document.getElementById("product-unit").value = product.unit
  document.getElementById("product-description").value = product.description
  document.getElementById("product-supplier").value = product.supplier
  document.getElementById("product-photo-preview").innerHTML = product.image
    ? `<img class="product-photo-large" src="${product.image}" alt="${product.name}">`
    : ""

  document.getElementById("product-modal").classList.add("active")
}

function deleteProduct(code) {
  if (confirm("¿Estás seguro de eliminar este producto?")) {
    products = products.filter((p) => p.code !== code)
    renderInventoryTable()
    loadAlerts() // Reload alerts after product deletion
    saveToStorage()
  }
}

function readProductImageFile() {
  const file = document.getElementById("product-image").files[0]
  if (!file) return Promise.resolve(null)

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

document.getElementById("product-image").addEventListener("change", async () => {
  const image = await readProductImageFile()
  document.getElementById("product-photo-preview").innerHTML = image
    ? `<img class="product-photo-large" src="${image}" alt="Vista previa del producto">`
    : ""
})

document.getElementById("product-form").addEventListener("submit", async (e) => {
  e.preventDefault()
  const existingProduct = products.find((p) => p.code === document.getElementById("product-code").value)
  const image = (await readProductImageFile()) || (existingProduct && existingProduct.image) || ""

  const productData = {
    code: document.getElementById("product-code").value,
    name: document.getElementById("product-name").value,
    category: document.getElementById("product-category").value,
    stock: Number.parseInt(document.getElementById("product-stock").value),
    minStock: Number.parseInt(document.getElementById("product-min-stock").value), // Added minStock field
    priceSale: Number.parseFloat(document.getElementById("product-price-sale").value),
    pricePurchase: Number.parseFloat(document.getElementById("product-price-purchase").value),
    taxRate: Number.parseFloat(document.getElementById("product-tax-rate").value),
    location: document.getElementById("product-location").value,
    unit: document.getElementById("product-unit").value,
    description: document.getElementById("product-description").value,
    supplier: document.getElementById("product-supplier").value,
    image,
    dateEntry: new Date().toISOString().split("T")[0],
  }

  const existingIndex = products.findIndex((p) => p.code === productData.code)

  if (existingIndex >= 0) {
    products[existingIndex] = productData
  } else {
    products.push(productData)
  }

  closeProductModal()
  renderInventoryTable()
  loadAlerts() // Reload alerts after product changes
  if (productData.stock <= productData.minStock) {
    alert(`Alerta de stock minimo: ${productData.name} tiene ${productData.stock} ${productData.unit || ""}. Debes surtir pronto.`)
  }
  saveToStorage()
})

// Clientes
function loadClients() {
  renderClientsTable()
  setupClientSearch()
}

function renderClientsTable() {
  const tbody = document.getElementById("clients-table-body")
  tbody.innerHTML = clients
    .map(
      (c) => `
        <tr>
            <td>${c.id}</td>
            <td>${c.name}</td>
            <td>${c.phone}</td>
            <td>${c.email}</td>
            <td>${c.address}</td>
            <td>$${c.totalPurchases.toFixed(2)}</td>
            <td>
                <button class="btn btn-secondary" onclick="editClient(${c.id})">Editar</button>
                <button class="btn btn-secondary" onclick="deleteClient(${c.id})">Eliminar</button>
            </td>
        </tr>
    `,
    )
    .join("")
}

function setupClientSearch() {
  document.getElementById("client-search").addEventListener("input", function () {
    const searchTerm = this.value.toLowerCase()
    const filtered = clients.filter(
      (c) =>
        c.name.toLowerCase().includes(searchTerm) ||
        c.phone.includes(searchTerm) ||
        c.email.toLowerCase().includes(searchTerm),
    )

    const tbody = document.getElementById("clients-table-body")
    tbody.innerHTML = filtered
      .map(
        (c) => `
            <tr>
                <td>${c.id}</td>
                <td>${c.name}</td>
                <td>${c.phone}</td>
                <td>${c.email}</td>
                <td>${c.address}</td>
                <td>$${c.totalPurchases.toFixed(2)}</td>
                <td>
                    <button class="btn btn-secondary" onclick="editClient(${c.id})">Editar</button>
                    <button class="btn btn-secondary" onclick="deleteClient(${c.id})">Eliminar</button>
                </td>
            </tr>
        `,
      )
      .join("")
  })
}

function showAddClientModal() {
  document.getElementById("client-modal-title").textContent = "Agregar Cliente"
  document.getElementById("client-form").reset()
  document.getElementById("client-modal").classList.add("active")
}

function closeClientModal() {
  document.getElementById("client-modal").classList.remove("active")
}

function editClient(id) {
  const client = clients.find((c) => c.id === id)
  if (!client) return

  document.getElementById("client-modal-title").textContent = "Editar Cliente"
  document.getElementById("client-name").value = client.name
  document.getElementById("client-phone").value = client.phone
  document.getElementById("client-email").value = client.email
  document.getElementById("client-address").value = client.address

  document.getElementById("client-modal").classList.add("active")
  document.getElementById("client-form").dataset.editId = id
}

function deleteClient(id) {
  if (confirm("¿Estás seguro de eliminar este cliente?")) {
    clients = clients.filter((c) => c.id !== id)
    renderClientsTable()
    saveToStorage()
  }
}

document.getElementById("client-form").addEventListener("submit", function (e) {
  e.preventDefault()

  const clientData = {
    name: document.getElementById("client-name").value,
    phone: document.getElementById("client-phone").value,
    email: document.getElementById("client-email").value,
    address: document.getElementById("client-address").value,
  }

  const editId = this.dataset.editId

  if (editId) {
    const client = clients.find((c) => c.id == editId)
    Object.assign(client, clientData)
    delete this.dataset.editId
  } else {
    clientData.id = clients.length > 0 ? Math.max(...clients.map((c) => c.id)) + 1 : 1
    clientData.totalPurchases = 0
    clients.push(clientData)
  }

  closeClientModal()
  renderClientsTable()
  loadClientSelect()
  saveToStorage()
})

// Reportes
function loadReports() {
  loadTopProducts()
  loadLowStock() // Use the updated loadLowStock

  const today = new Date().toISOString().split("T")[0]
  document.getElementById("report-start-date").value = today
  document.getElementById("report-end-date").value = today
}

function loadTopProducts() {
  const productSales = {}

  sales.forEach((sale) => {
    sale.items.forEach((item) => {
      if (!productSales[item.code]) {
        productSales[item.code] = {
          name: item.name,
          quantity: 0,
          revenue: 0,
        }
      }
      productSales[item.code].quantity += item.quantity
      productSales[item.code].revenue += item.price * item.quantity
    })
  })

  const topProducts = Object.entries(productSales)
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .slice(0, 5)

  const topProductsList = document.getElementById("top-products-list")

  if (topProducts.length === 0) {
    topProductsList.innerHTML = '<p style="padding: 1rem; color: var(--gray-600);">No hay ventas registradas</p>'
    return
  }

  topProductsList.innerHTML = topProducts
    .map(
      ([code, data], index) => `
    <div style="padding: 0.75rem; border-bottom: 1px solid var(--gray-200);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong>${index + 1}. ${data.name}</strong>
          <div style="font-size: 0.875rem; color: var(--gray-600);">
            Cantidad: ${data.quantity} | Ingresos: $${data.revenue.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  `,
    )
    .join("")
}

function loadAlerts() {
  const lowStockProducts = products.filter((p) => p.stock < (p.minStock || 5))
  const alertsList = document.getElementById("alerts-list")
  const alertBadge = document.getElementById("low-stock-badge")
  const showAllBtn = document.getElementById("show-all-alerts-btn")

  alertBadge.textContent = lowStockProducts.length

  if (lowStockProducts.length > 0) {
    const productsToShow = showingAllAlerts ? lowStockProducts : lowStockProducts.slice(0, 10)

    alertsList.innerHTML = productsToShow
      .map(
        (p) =>
          `<div class="alert-item" style="padding: 0.5rem; border-bottom: 1px solid var(--gray-200);">
                <strong>${p.name}</strong> - Stock: ${p.stock} ${p.unit} (Mín: ${p.minStock || 5})
            </div>`,
      )
      .join("")

    // Show button only if there are more than 10 alerts
    if (lowStockProducts.length > 10) {
      showAllBtn.style.display = "block"
      showAllBtn.textContent = showingAllAlerts ? "Mostrar Menos" : `Mostrar Todas (${lowStockProducts.length})`
    } else {
      showAllBtn.style.display = "none"
    }
  } else {
    alertsList.innerHTML = '<p class="no-alerts">Sin alertas en este momento</p>'
    showAllBtn.style.display = "none"
  }
}

function toggleAllAlerts() {
  showingAllAlerts = !showingAllAlerts
  loadAlerts()
}

function loadLowStock() {
  const lowStockProducts = products.filter((p) => p.stock <= (p.minStock || 5))
  const lowStockList = document.getElementById("low-stock-list")

  if (lowStockProducts.length === 0) {
    lowStockList.innerHTML =
      '<p style="padding: 1rem; color: var(--success);">Todos los productos tienen stock suficiente</p>'
    return
  }

  lowStockList.innerHTML = lowStockProducts
    .map(
      (p) => `
    <div style="padding: 0.75rem; border-bottom: 1px solid var(--gray-200);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong>${p.name}</strong> (${p.code})
          <div style="font-size: 0.875rem; color: var(--danger); font-weight: bold;">
            Stock actual: ${p.stock} ${p.unit} | Stock mínimo: ${p.minStock || 5} ${p.unit} {/* Updated to show minStock */}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.875rem; color: var(--text-secondary);">Ubicación: ${p.location}</div>
        </div>
      </div>
    </div>
  `,
    )
    .join("")
}

function generateSalesReport() {
  const startDate = new Date(document.getElementById("report-start-date").value)
  const endDate = new Date(document.getElementById("report-end-date").value)

  endDate.setHours(23, 59, 59, 999)

  const filteredSales = sales.filter((sale) => {
    const saleDate = new Date(sale.date)
    return saleDate >= startDate && saleDate <= endDate
  })

  const total = filteredSales.reduce((sum, sale) => sum + sale.total, 0)
  const transactions = filteredSales.length

  alert(
    `Reporte de Ventas\n\nPeríodo: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}\nTransacciones: ${transactions}\nTotal: $${total.toFixed(2)}`,
  )
}

function getSalesInSelectedRange() {
  const startValue = document.getElementById("report-start-date").value
  const endValue = document.getElementById("report-end-date").value

  if (!startValue || !endValue) return sales

  const startDate = new Date(startValue)
  const endDate = new Date(endValue)
  endDate.setHours(23, 59, 59, 999)

  return sales.filter((sale) => {
    const saleDate = new Date(sale.date)
    return saleDate >= startDate && saleDate <= endDate
  })
}

function exportSalesToExcel() {
  const selectedSales = getSalesInSelectedRange()
  const rows = [
    ["venta_id", "fecha", "cliente_id", "metodo_pago", "producto_codigo", "producto", "cantidad", "precio_unitario", "subtotal_linea", "subtotal_sin_iva", "iva", "total"],
  ]

  selectedSales.forEach((sale) => {
    sale.items.forEach((item) => {
      const lineTotal = item.price * item.quantity
      const rate = Number(item.taxRate ?? 0.19)
      const lineTax = rate > 0 ? lineTotal - lineTotal / (1 + rate) : 0
      rows.push([
        sale.id,
        sale.date,
        sale.clientId || "",
        sale.paymentMethod || "",
        item.code,
        item.name,
        item.quantity,
        item.price,
        lineTotal,
        lineTotal - lineTax,
        lineTax,
        lineTotal,
      ])
    })
  })

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `ventas-power-bi-${new Date().toISOString().split("T")[0]}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function showDianSummary() {
  const selectedSales = getSalesInSelectedRange()
  const total = selectedSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0)
  const iva = selectedSales.reduce((sum, sale) => {
    if (typeof sale.tax === "number") return sum + sale.tax
    return (
      sum +
      sale.items.reduce((itemSum, item) => {
        const lineTotal = item.price * item.quantity
        const rate = Number(item.taxRate ?? 0.19)
        return itemSum + (rate > 0 ? lineTotal - lineTotal / (1 + rate) : 0)
      }, 0)
    )
  }, 0)
  const base = total - iva

  alert(
    `Posible pago a la DIAN\n\nVentas seleccionadas: ${selectedSales.length}\nBase gravable estimada: $${base.toFixed(2)}\nIVA generado estimado: $${iva.toFixed(2)}\nTotal vendido: $${total.toFixed(2)}\n\nEste resumen es informativo; confirmalo con tu contador antes de declarar.`,
  )
}

// Cierre de Caja
function loadCloseRegister() {
  const todaySales = sales.filter((sale) => {
    const saleDate = new Date(sale.date)
    const today = new Date()
    return saleDate.toDateString() === today.toDateString()
  })

  const cashTotal = todaySales.filter((s) => s.paymentMethod === "cash").reduce((sum, s) => sum + s.total, 0)
  const cardTotal = todaySales
    .filter((s) => ["card", "debit", "credit_card"].includes(s.paymentMethod))
    .reduce((sum, s) => sum + s.total, 0)
  const transferTotal = todaySales.filter((s) => s.paymentMethod === "transfer").reduce((sum, s) => sum + s.total, 0)
  const nequiTotal = todaySales.filter((s) => s.paymentMethod === "nequi").reduce((sum, s) => sum + s.total, 0)
  const dayTotal = cashTotal + cardTotal + transferTotal + nequiTotal

  const initialBalance = Number.parseFloat(localStorage.getItem("initialBalance")) || 0
  const totalCashWithInitial = cashTotal + initialBalance

  document.getElementById("close-cash-total").textContent = totalCashWithInitial.toFixed(2)
  document.getElementById("close-card-total").textContent = cardTotal.toFixed(2)
  document.getElementById("close-transfer-total").textContent = transferTotal.toFixed(2)
  document.getElementById("close-nequi-total").textContent = nequiTotal.toFixed(2)
  document.getElementById("close-day-total").textContent = dayTotal.toFixed(2)

  document.getElementById("actual-cash").addEventListener("input", function () {
    const actualCash = Number.parseFloat(this.value) || 0
    const difference = actualCash - totalCashWithInitial
    const diffDisplay = document.getElementById("cash-difference")

    diffDisplay.textContent = `$${difference.toFixed(2)}`
    diffDisplay.style.color = difference >= 0 ? "var(--success)" : "var(--danger)"
  })
}

function getTodaySales() {
  return sales.filter((sale) => {
    const saleDate = new Date(sale.date)
    const today = new Date()
    return saleDate.toDateString() === today.toDateString()
  })
}

function printCloseRegisterReport(closeData) {
  const todaySales = getTodaySales()
  const initialBalance = Number.parseFloat(localStorage.getItem("initialBalance")) || 0
  const cashSales = todaySales.filter((s) => s.paymentMethod === "cash").reduce((sum, s) => sum + Number(s.total || 0), 0)
  const cardSales = todaySales
    .filter((s) => ["card", "debit", "credit_card"].includes(s.paymentMethod))
    .reduce((sum, s) => sum + Number(s.total || 0), 0)
  const transferSales = todaySales
    .filter((s) => s.paymentMethod === "transfer")
    .reduce((sum, s) => sum + Number(s.total || 0), 0)
  const nequiSales = todaySales.filter((s) => s.paymentMethod === "nequi").reduce((sum, s) => sum + Number(s.total || 0), 0)
  const totalSales = todaySales.reduce((sum, s) => sum + Number(s.total || 0), 0)
  const totalTax = todaySales.reduce((sum, s) => sum + Number(s.tax || 0), 0)

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Cierre de Caja INCOVE</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 820px; margin: 20px auto; padding: 20px; color: #111827; }
        .header { border-bottom: 3px solid #0f766e; padding-bottom: 14px; margin-bottom: 20px; }
        .header h1 { margin: 0; color: #0f766e; font-size: 28px; }
        .header p { margin: 4px 0; color: #374151; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; margin: 18px 0; }
        .line { display: flex; justify-content: space-between; border-bottom: 1px solid #e5e7eb; padding: 6px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 18px; }
        th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
        th { background: #f3f4f6; }
        .total { font-weight: 700; color: #0f766e; }
        .footer { margin-top: 24px; border-top: 1px solid #d1d5db; padding-top: 12px; font-size: 13px; color: #4b5563; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>INCOVE</h1>
        <p><strong>Ingeniería y Construcciones Venecia</strong></p>
        <p>REPORTE DE CIERRE DE CAJA</p>
      </div>

      <div class="grid">
        <div class="line"><span>Fecha:</span><strong>${new Date(closeData.date).toLocaleString("es-CO")}</strong></div>
        <div class="line"><span>Transacciones:</span><strong>${todaySales.length}</strong></div>
        <div class="line"><span>Saldo base:</span><strong>$${initialBalance.toFixed(2)}</strong></div>
        <div class="line"><span>IVA estimado:</span><strong>$${totalTax.toFixed(2)}</strong></div>
        <div class="line"><span>Efectivo ventas:</span><strong>$${cashSales.toFixed(2)}</strong></div>
        <div class="line"><span>Efectivo esperado con base:</span><strong>$${closeData.cashExpected.toFixed(2)}</strong></div>
        <div class="line"><span>Efectivo real:</span><strong>$${closeData.cashActual.toFixed(2)}</strong></div>
        <div class="line"><span>Diferencia:</span><strong>$${closeData.difference.toFixed(2)}</strong></div>
        <div class="line"><span>Tarjetas:</span><strong>$${cardSales.toFixed(2)}</strong></div>
        <div class="line"><span>Transferencias:</span><strong>$${transferSales.toFixed(2)}</strong></div>
        <div class="line"><span>Nequi:</span><strong>$${nequiSales.toFixed(2)}</strong></div>
        <div class="line total"><span>Total ventas del día:</span><strong>$${totalSales.toFixed(2)}</strong></div>
      </div>

      <h3>Detalle de ventas</h3>
      <table>
        <thead>
          <tr><th>#</th><th>Hora</th><th>Método</th><th>Productos</th><th>Total</th></tr>
        </thead>
        <tbody>
          ${
            todaySales.length
              ? todaySales
                  .map(
                    (sale) => `
              <tr>
                <td>${sale.id}</td>
                <td>${new Date(sale.date).toLocaleTimeString("es-CO")}</td>
                <td>${sale.paymentMethod || ""}</td>
                <td>${(sale.items || []).map((item) => `${item.name} x${item.quantity}`).join(", ")}</td>
                <td>$${Number(sale.total || 0).toFixed(2)}</td>
              </tr>`,
                  )
                  .join("")
              : '<tr><td colspan="5">No hubo ventas registradas hoy.</td></tr>'
          }
        </tbody>
      </table>

      <div class="footer">
        <p><strong>Notas:</strong> ${closeData.notes || "Sin notas"}</p>
        <p>Reporte generado automáticamente al cerrar caja.</p>
      </div>
      <script>window.onload = function(){ window.print(); }</script>
    </body>
    </html>
  `

  const printWindow = window.open("", "_blank")
  printWindow.document.write(html)
  printWindow.document.close()
}

function loadQuotes() {
  renderQuoteCart()
  setupQuoteProductSearch()
  if (!document.getElementById("quote-valid-until").value) {
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + 8)
    document.getElementById("quote-valid-until").value = validUntil.toISOString().split("T")[0]
  }
}

function setupQuoteProductSearch() {
  const searchInput = document.getElementById("quote-product-search")
  const searchResults = document.getElementById("quote-search-results")
  if (!searchInput || searchInput.dataset.ready === "true") return
  searchInput.dataset.ready = "true"

  searchInput.addEventListener("input", function () {
    const query = this.value.toLowerCase()
    if (query.length < 2) {
      searchResults.classList.remove("active")
      return
    }

    const results = products.filter((p) => p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query))
    searchResults.innerHTML = results.length
      ? results
          .map(
            (p) => `<div class="search-result-item" onclick="selectQuoteProduct('${p.code}')">
              <strong>${p.name}</strong> (${p.code}) - $${Number(p.priceSale || 0).toFixed(2)}
            </div>`,
          )
          .join("")
      : '<div class="search-result-item">No se encontraron productos</div>'
    searchResults.classList.add("active")
  })
}

function selectQuoteProduct(productCode) {
  const product = products.find((p) => p.code === productCode)
  if (!product) return
  document.getElementById("quote-product-search").value = product.name
  document.getElementById("quote-product-search").dataset.code = product.code
  document.getElementById("quote-search-results").classList.remove("active")
  document.getElementById("quote-quantity").focus()
}

function addToQuoteCart() {
  const searchValue = document.getElementById("quote-product-search").value.toLowerCase()
  const selectedCode = document.getElementById("quote-product-search").dataset.code
  const quantity = Number.parseFloat(document.getElementById("quote-quantity").value)
  const product = products.find(
    (p) => p.code === selectedCode || p.code.toLowerCase() === searchValue || p.name.toLowerCase() === searchValue,
  )

  if (!product || !quantity || quantity <= 0) {
    alert("Selecciona un producto y una cantidad valida")
    return
  }

  const existing = quoteCart.find((item) => item.code === product.code)
  if (existing) {
    existing.quantity += quantity
  } else {
    quoteCart.push({
      code: product.code,
      name: product.name,
      price: Number(product.priceSale || 0),
      quantity,
      taxRate: Number(product.taxRate ?? 0.19),
    })
  }

  document.getElementById("quote-product-search").value = ""
  document.getElementById("quote-product-search").dataset.code = ""
  document.getElementById("quote-quantity").value = "1"
  renderQuoteCart()
}

function removeFromQuoteCart(productCode) {
  quoteCart = quoteCart.filter((item) => item.code !== productCode)
  renderQuoteCart()
}

function renderQuoteCart() {
  const list = document.getElementById("quote-products-list")
  if (!list) return

  if (quoteCart.length === 0) {
    list.innerHTML = '<p style="padding: 1rem; color: var(--gray-600);">No hay productos en la cotización</p>'
    document.getElementById("quote-total").textContent = "0.00"
    return
  }

  list.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Código</th><th>Producto</th><th>Cant.</th><th>Precio</th><th>Total</th><th>Acción</th></tr>
      </thead>
      <tbody>
        ${quoteCart
          .map(
            (item) => `
          <tr>
            <td>${item.code}</td>
            <td>${item.name}</td>
            <td>${item.quantity}</td>
            <td>$${item.price.toFixed(2)}</td>
            <td>$${(item.price * item.quantity).toFixed(2)}</td>
            <td><button class="btn btn-secondary" onclick="removeFromQuoteCart('${item.code}')">Quitar</button></td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>`
  document.getElementById("quote-total").textContent = calculateCartTotals(quoteCart).total.toFixed(2)
}

function clearQuoteCart() {
  quoteCart = []
  renderQuoteCart()
}

function saveAndPrintQuote() {
  const clientName = document.getElementById("quote-client-name").value.trim()
  const clientPhone = document.getElementById("quote-client-phone").value.trim()
  const validUntil = document.getElementById("quote-valid-until").value

  if (!clientName || !clientPhone) {
    alert("Para cotizar debes ingresar nombre, apellido y celular del cliente.")
    return
  }

  if (quoteCart.length === 0) {
    alert("Agrega al menos un producto a la cotización.")
    return
  }

  const totals = calculateCartTotals(quoteCart)
  const quote = {
    id: quotations.length + 1,
    date: new Date().toISOString(),
    validUntil,
    clientName,
    clientPhone,
    items: [...quoteCart],
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
  }

  quotations.push(quote)
  saveToStorage()
  printQuoteWindow(quote)
  clearQuoteCart()
}

function printQuoteWindow(quote) {
  const html = buildBusinessDocumentHtml({
    title: `Cotización #${quote.id}`,
    documentLabel: "COTIZACIÓN",
    numberLabel: "Cotización No:",
    number: quote.id,
    date: quote.date,
    clientName: quote.clientName,
    clientPhone: quote.clientPhone,
    validUntil: quote.validUntil,
    items: quote.items,
    subtotal: quote.subtotal,
    tax: quote.tax,
    total: quote.total,
    footer: "Esta cotización no separa mercancía ni descuenta inventario. Valores sujetos a disponibilidad.",
  })

  const printWindow = window.open("", "_blank")
  printWindow.document.write(html)
  printWindow.document.close()
}

function closeRegister() {
  const actualCash = Number.parseFloat(document.getElementById("actual-cash").value) || 0
  const notes = document.getElementById("close-notes").value
  const cashExpected = Number.parseFloat(document.getElementById("close-cash-total").textContent)
  const difference = actualCash - cashExpected

  if (
    confirm(
      `¿Confirmar cierre de caja?\n\nEfectivo esperado: $${cashExpected.toFixed(2)}\nEfectivo real: $${actualCash.toFixed(2)}\nDiferencia: $${difference.toFixed(2)}`,
    )
  ) {
    const closeData = {
      date: new Date().toISOString(),
      cashExpected: cashExpected,
      cashActual: actualCash,
      difference: difference,
      notes: notes,
      dayTotal: Number.parseFloat(document.getElementById("close-day-total").textContent),
    }

    const closures = JSON.parse(localStorage.getItem("closures")) || []
    closures.push(closeData)
    localStorage.setItem("closures", JSON.stringify(closures))

    exportData()
    printCloseRegisterReport(closeData)

    alert("Caja cerrada correctamente. Se exportaron los datos y se generó el reporte imprimible.")

    document.getElementById("actual-cash").value = ""
    document.getElementById("close-notes").value = ""
    document.getElementById("cash-difference").textContent = "$0.00"

    loadCloseRegister()
  }
}

// Créditos
function loadCredits() {
  renderCredits()
  renderCreditCart()
  populateCreditClientSelect()
  setupCreditProductSearch()
  toggleCreditClientMode()
  updateCreditStats()
}

function toggleCreditClientMode() {
  const mode = document.getElementById("credit-client-mode").value
  document.querySelectorAll(".credit-existing-client").forEach((el) => {
    el.style.display = mode === "existing" ? "block" : "none"
  })
  document.querySelectorAll(".credit-new-client").forEach((el) => {
    el.style.display = mode === "new" ? "block" : "none"
  })
}

function addToCreditCart() {
  const searchValue = document.getElementById("credit-product-search").value.toLowerCase()
  const quantity = Number.parseFloat(document.getElementById("credit-quantity").value)

  if (!searchValue) {
    alert("Por favor busque y seleccione un producto")
    return
  }

  const product = products.find((p) => p.code.toLowerCase() === searchValue || p.name.toLowerCase() === searchValue)

  if (!product) {
    alert("Producto no encontrado")
    return
  }

  if (quantity > product.stock) {
    alert(`Stock insuficiente. Disponible: ${product.stock}`)
    return
  }

  const existingItem = creditCart.find((item) => item.code === product.code)
  if (existingItem) {
    existingItem.quantity += quantity
    existingItem.subtotal = existingItem.quantity * existingItem.price
  } else {
    creditCart.push({
      code: product.code,
      name: product.name,
      price: product.priceSale,
      quantity: quantity,
      subtotal: product.priceSale * quantity,
    })
  }

  document.getElementById("credit-product-search").value = ""
  document.getElementById("credit-quantity").value = "1"
  document.getElementById("credit-search-results").classList.remove("active")
  renderCreditCart()
}

function removeFromCreditCart(index) {
  creditCart.splice(index, 1)
  renderCreditCart()
}

function renderCreditCart() {
  const list = document.getElementById("credit-products-list")
  const totalElement = document.getElementById("credit-total")

  if (creditCart.length === 0) {
    list.innerHTML = "<p>No hay productos en el carrito de crédito</p>"
    totalElement.textContent = "0.00"
    return
  }

  list.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Producto</th>
                    <th>Precio</th>
                    <th>Cantidad</th>
                    <th>Subtotal</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${creditCart
                  .map(
                    (item, index) => `
                    <tr>
                        <td>${item.name}</td>
                        <td>$${item.price.toFixed(2)}</td>
                        <td>${item.quantity}</td>
                        <td>$${item.subtotal.toFixed(2)}</td>
                        <td>
                            <button class="btn btn-danger btn-sm" onclick="removeFromCreditCart(${index})">
                                🗑️ Eliminar
                            </button>
                        </td>
                    </tr>
                `,
                  )
                  .join("")}
            </tbody>
        </table>
    `

  const total = creditCart.reduce((sum, item) => sum + item.subtotal, 0)
  totalElement.textContent = total.toFixed(2)
}

function completeCreditSale() {
  const mode = document.getElementById("credit-client-mode").value
  let clientId = document.getElementById("credit-client-select").value
  let client = null

  if (mode === "new") {
    const name = document.getElementById("credit-new-client-name").value.trim()
    const phone = document.getElementById("credit-new-client-phone").value.trim()
    const address = document.getElementById("credit-new-client-address").value.trim()

    if (!name || !phone) {
      alert("Para fiar a un cliente nuevo debes ingresar nombre, apellido y celular.")
      return
    }

    client = {
      id: clients.length > 0 ? Math.max(...clients.map((c) => c.id)) + 1 : 1,
      name,
      phone,
      email: "",
      address,
      totalPurchases: 0,
    }
    clients.push(client)
    clientId = client.id
  } else {
    if (!clientId) {
      alert("Debe seleccionar un cliente registrado o crear uno nuevo.")
      return
    }
    client = clients.find((c) => c.id == clientId)
  }

  if (creditCart.length === 0) {
    alert("El carrito está vacío")
    return
  }

  const total = Number.parseFloat(document.getElementById("credit-total").textContent)

  const creditSale = {
    id: creditSales.length + 1,
    date: new Date().toISOString(),
    clientId: Number.parseInt(clientId),
    clientName: client ? client.name : "",
    clientPhone: client ? client.phone : "",
    items: [...creditCart],
    total: total,
    paid: false,
    paymentDate: null,
  }

  creditSales.push(creditSale)

  creditCart.forEach((item) => {
    const product = products.find((p) => p.code === item.code)
    if (product) {
      product.stock -= item.quantity
    }
  })

  saveToStorage()
  alert(
    `Venta a crédito registrada!\nCliente: ${clients.find((c) => c.id == clientId).name}\nTotal: $${total.toFixed(2)}`,
  )

  creditCart = []
  document.getElementById("credit-new-client-name").value = ""
  document.getElementById("credit-new-client-phone").value = ""
  document.getElementById("credit-new-client-address").value = ""
  populateCreditClientSelect()
  renderCreditCart()
  renderCredits()
}

function markCreditAsPaid(creditId) {
  const credit = creditSales.find((c) => c.id === creditId)
  if (credit) {
    credit.paid = true
    credit.paymentDate = new Date().toISOString()

    const client = clients.find((c) => c.id === credit.clientId)
    if (client) {
      client.totalPurchases += credit.total
    }

    saveToStorage()
    renderCredits()
    alert("Crédito marcado como pagado")
  }
}

function renderCredits() {
  const filter = document.getElementById("credit-filter").value
  let filteredCredits = creditSales

  if (filter === "pending") {
    filteredCredits = creditSales.filter((c) => !c.paid)
  } else if (filter === "paid") {
    filteredCredits = creditSales.filter((c) => c.paid)
  }

  const list = document.getElementById("credits-list")

  if (filteredCredits.length === 0) {
    list.innerHTML = "<p>No hay fiados por cobrar</p>"
    updateCreditStats()
    return
  }

  list.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${filteredCredits
                  .map(
                    (credit) => `
                    <tr>
                        <td>${new Date(credit.date).toLocaleDateString()}</td>
                        <td>${clients.find((c) => c.id === credit.clientId).name}</td>
                        <td>$${credit.total.toFixed(2)}</td>
                        <td>
                            <span class="status-badge status-${credit.paid ? "paid" : "pending"}">
                                ${credit.paid ? "✅ Pagado" : "⏳ Pendiente"}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-info btn-sm" onclick="viewCreditDetails(${credit.id})">
                                👁️ Ver
                            </button>
                            ${
                              !credit.paid
                                ? `<button class="btn btn-success btn-sm" onclick="markCreditAsPaid(${credit.id})">
                                💰 Marcar Pagado
                            </button>`
                                : ""
                            }
                        </td>
                    </tr>
                `,
                  )
                  .join("")}
            </tbody>
        </table>
    `

  updateCreditStats()
}

function showCreditDetails(creditId) {
  const credit = creditSales.find((c) => c.id === creditId)
  if (!credit) return

  const client = clients.find((c) => c.id === credit.clientId)
  let details = `=== DETALLES DE CRÉDITO ===\n\n`
  details += `ID: ${credit.id}\n`
  details += `Cliente: ${client ? client.name : "N/A"}\n`
  details += `Fecha: ${new Date(credit.date).toLocaleString()}\n`
  details += `Estado: ${credit.paid ? "Pagado" : "Pendiente"}\n`
  if (credit.paid) {
    details += `Fecha de Pago: ${new Date(credit.paymentDate).toLocaleString()}\n`
  }
  details += `\n--- PRODUCTOS ---\n`
  credit.items.forEach((item) => {
    details += `${item.name} x${item.quantity} - $${item.subtotal.toFixed(2)}\n`
  })
  details += `\nTOTAL: $${credit.total.toFixed(2)}`

  alert(details)
}

function showSection(sectionName) {
  document.querySelectorAll(".nav-btn").forEach((btn) => btn.classList.remove("active"))
  document.querySelectorAll(".module").forEach((module) => module.classList.remove("active"))

  const button = document.querySelector(`[data-module="${sectionName}"]`)
  if (button) button.classList.add("active")

  const module = document.getElementById(`${sectionName}-module`)
  if (module) module.classList.add("active")

  if (sectionName === "credits") {
    loadCredits()
    renderCreditCart()
    populateCreditClientSelect()
  } else if (sectionName === "quotes") {
    loadQuotes()
  } else if (sectionName === "pos") {
    loadPOS()
  } else if (sectionName === "inventory") {
    loadInventory()
  } else if (sectionName === "clients") {
    loadClients()
  } else if (sectionName === "reports") {
    loadReports()
  } else if (sectionName === "close-register") {
    loadCloseRegister()
  } else if (sectionName === "dashboard") {
    loadDashboard()
  }
}

function populateCreditClientSelect() {
  const select = document.getElementById("credit-client-select")
  select.innerHTML = '<option value="">Seleccionar cliente</option>'
  clients.forEach((client) => {
    const option = document.createElement("option")
    option.value = client.id
    option.textContent = `${client.name} - ${client.phone}`
    select.appendChild(option)
  })
}

function renderInventory() {
  renderInventoryTable()
  loadCategoryFilter()
  setupInventorySearch()
}

function renderClients() {
  renderClientsTable()
  setupClientSearch()
}

function renderReports() {
  loadTopProducts()
  loadLowStock() // Use the updated loadLowStock
}

function renderCloseRegister() {
  loadCloseRegister()
}

function renderDashboard() {
  loadDashboard()
}

// Inicializar
console.log("[v0] Sistema INCOVE cargado correctamente")

function startSession() {
  const rawInitialBalance = document.getElementById("initial-balance").value
  const initialBalance = rawInitialBalance === "" ? 0 : Number.parseFloat(rawInitialBalance)

  if (Number.isNaN(initialBalance) || initialBalance < 0) {
    alert("El saldo inicial no puede ser negativo")
    return
  }

  const todayDate = new Date().toDateString()
  localStorage.setItem("initialBalance", initialBalance.toString())
  localStorage.setItem("initialBalanceDate", todayDate)

  // Hide modal
  document.getElementById("initial-balance-modal").classList.remove("active")
  document.getElementById("initial-balance-modal").style.display = "none"

  // Show app section with dashboard
  document.getElementById("app-section").classList.add("active")
  showSection("dashboard")

  saveToStorage()
  loadDashboard()
}

function setupCreditProductSearch() {
  const searchInput = document.getElementById("credit-product-search")
  const searchResults = document.getElementById("credit-search-results")

  searchInput.addEventListener("input", function () {
    const query = this.value.toLowerCase()

    if (query.length < 2) {
      searchResults.classList.remove("active")
      return
    }

    const results = products.filter((p) => p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query))

    if (results.length > 0) {
      searchResults.innerHTML = results
        .map(
          (p) =>
            `<div class="search-result-item" onclick="selectCreditProduct('${p.code}')">
                    <div><strong>${p.name}</strong></div>
                    <div style="font-size: 0.9rem; color: #666;">Código: ${p.code} | Stock: ${p.stock} | $${p.priceSale.toFixed(2)}</div>
                </div>`,
        )
        .join("")
      searchResults.classList.add("active")
    } else {
      searchResults.innerHTML = '<div class="search-result-item">No se encontraron productos</div>'
      searchResults.classList.add("active")
    }
  })

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.classList.remove("active")
    }
  })
}

function selectCreditProduct(productCode) {
  const product = products.find((p) => p.code === productCode)
  if (product) {
    document.getElementById("credit-product-search").value = product.name
    document.getElementById("credit-search-results").classList.remove("active")
    document.getElementById("credit-quantity").focus()
  }
}

function updateCreditStats() {
  const pendingCredits = creditSales.filter((c) => !c.paid)
  const paidToday = creditSales.filter((c) => {
    if (!c.paid) return false
    const today = new Date().toDateString()
    const paidDate = new Date(c.paymentDate).toDateString()
    return today === paidDate
  })

  document.getElementById("pending-credits-count").textContent = pendingCredits.length
  document.getElementById("pending-credits-total").textContent =
    "$" + pendingCredits.reduce((sum, c) => sum + c.total, 0).toFixed(2)
  document.getElementById("paid-credits-today").textContent = paidToday.length
}

function viewCreditDetails(creditId) {
  const credit = creditSales.find((c) => c.id === creditId)
  if (!credit) return

  const client = clients.find((c) => c.id === credit.clientId)
  let details = `=== DETALLES DE CRÉDITO ===\n\n`
  details += `ID: ${credit.id}\n`
  details += `Cliente: ${client ? client.name : "N/A"}\n`
  details += `Fecha: ${new Date(credit.date).toLocaleString()}\n`
  details += `Estado: ${credit.paid ? "Pagado" : "Pendiente"}\n`
  if (credit.paid) {
    details += `Fecha de Pago: ${new Date(credit.paymentDate).toLocaleString()}\n`
  }
  details += `\n--- PRODUCTOS ---\n`
  credit.items.forEach((item) => {
    details += `${item.name} x${item.quantity} - $${item.subtotal.toFixed(2)}\n`
  })
  details += `\nTOTAL: $${credit.total.toFixed(2)}`

  alert(details)
}
