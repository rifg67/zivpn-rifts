# 🚀 ZiVPN UDP Tunnel
### *High-Performance UDP Tunneling Solution by PeyxDev*

<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/Node.js-20.x-darkgreen?style=for-the-badge&logo=node.js" alt="Node">
  <img src="https://img.shields.io/badge/Platform-Linux-lightgrey?style=for-the-badge&logo=linux" alt="Platform">
</p>

---

## 📸 Preview

<p align="center">
  <img src="preview.png" alt="ZiVPN Preview" width="80%">
  <br>
  <sub><i>ZiVPN UDP Manager System</i></sub>
</p>

---

## ⚡ Deskripsi Utama
**ZiVPN** adalah solusi tunneling UDP premium yang dirancang untuk kecepatan dan kemudahan manajemen. Kelola server VPN Anda secara modern melalui **API powerful** atau **Bot Telegram** cerdas yang terintegrasi dengan sistem pembayaran **QRIS Dinamis** otomatis.

---

## ✨ Fitur Unggulan

| Komponen | Deskripsi Fitur |
| :--- | :--- |
| 🛠️ **Instalasi Modern** | Installer bersih dengan animasi loading dan informasi spek VPS otomatis. |
| 🧠 **Headless Management** | Kontrol penuh via API/Telegram, meminimalkan interaksi CLI yang rumit. |
| 🤖 **Bot Telegram Pro** | Manajemen user (Tambah, Hapus, Perpanjang) langsung dari chat. |
| 💸 **QRIS Dinamis** | Pembayaran otomatis real-time. Akun dibuat detik itu juga setelah bayar. |
| 🔒 **Security First** | Auto-generate API Key dan Sertifikat SSL saat proses instalasi. |
| 🚀 **Core Optimized** | Menggunakan core ZiVPN yang dioptimalkan khusus untuk arsitektur Linux AMD64. |

---

## 💳 Sistem Pembayaran QRIS Dinamis

Sistem ini menghilangkan kebutuhan konfirmasi manual oleh admin. 

### 🔄 Alur Kerja Otomatis:
1. **Pilih Durasi**: User menentukan masa aktif akun melalui bot.
2. **Kalkulasi**: Bot menghitung total biaya secara presisi.
3. **Generate QR**: Memanggil API QRIS Dinamis untuk membuat kode pembayaran unik.
4. **Pembayaran & Verifikasi**: User bayar dan upload bukti.
5. **Instant Delivery**: Bot memverifikasi dan mengirim detail akun secara instan.

### ⚙️ Konfigurasi QRIS (`bot-config.json`)
```json
{
    "qris": {
        "static_string": "00020101021126610014COM.GO-JEK.WWW...",
        "api_url": "https://api-mininxd.vercel.app/qris",
        "qr_size": 400,
        "icon_size": 80
    }
}
```

---

## 📥 Panduan Instalasi

Jalankan perintah *one-liner* berikut sebagai user **root**:

```bash
wget -q https://raw.githubusercontent.com/rifg67/zivpn-rifts/main/install.sh && chmod +x install.sh && ./install.sh
```

> [!IMPORTANT]
> Pastikan Anda sudah menyiapkan **Domain** (untuk SSL), **Bot Token** dari @BotFather, dan **Admin ID** Telegram Anda.

---

## 🤖 Menu & Perintah Bot

### 📌 User Menu
- `🛒 BELI AKUN PREMIUM` - Transaksi via QRIS.
- `🎫 TRIAL 30 MENIT` - Testing performa gratis.
- `📊 SYSTEM INFO` - Monitor status server.
- `📞 HUBUNGI ADMIN` - Support langsung.

### 👑 Admin Commands
| Command | Fungsi |
| :--- | :--- |
| `/users` | List semua user terdaftar |
| `/stats` | Statistik detail (Aktif/Expired/Locked) |
| `/create [user] [days]` | Membuat user secara manual |
| `/delete [user]` | Menghapus akses user |

---

## 🔌 Dokumentasi API (v1)

Server API berjalan secara default pada port `8585`.

**Authentication:**
`X-API-Key: YOUR_API_KEY`

| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/users` | Mengambil semua data user |
| `POST` | `/api/user/create` | Membuat user baru via JSON |
| `POST` | `/api/user/renew` | Memperpanjang masa aktif |
| `POST` | `/api/user/lock` | Mengunci akses user |

---

## 🛠️ Manajemen Service

Gunakan `systemctl` untuk mengelola komponen ZiVPN:

```bash
# Melakukan restart pada semua layanan
systemctl restart zivpn zivpn-api-js zivpn-bot

# Memeriksa log aktivitas bot secara real-time
journalctl -u zivpn-bot -f
```

---

## 📞 Dukungan & Komunitas
- **Developer**: [@PeyxDev](https://t.me/PeyxDev)
- **Repository**: [rifg67/zivpn-rifts](https://github.com/rifg67/zivpn-rifts)

<br>

<div align="center">
  <p>Built with ❤️ by <b>PeyxDev</b></p>
</div>
