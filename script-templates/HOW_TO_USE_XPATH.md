# Hướng dẫn tìm XPath và sử dụng Script Template

## 🎯 Bước 1: Tìm XPath bằng UI Inspector

### 1. Mở app X trên LDPlayer
- Launch profile
- Mở app X (Twitter)
- Vào màn hình đăng nhập

### 2. Vào tab Inspector
- Click vào Profile Details
- Chọn tab "Inspector" (icon 🔍)

### 3. Tìm XPath cho Username Field

#### **Cách 1: Auto-Search (KHUYÊN DÙNG)**
```
1. Nhập "username" hoặc "phone" vào search box
2. Click "Search"
3. Kết quả hiện ra, ví dụ:

   ┌────────────────────────────────────────┐
   │ "Phone, email or username"             │
   │ android.widget.EditText                │
   │ com.twitter.android:id/login_identifier│
   │ Match: Resource-id: "login_identifier" │
   └────────────────────────────────────────┘

4. Click vào kết quả này
5. XPath suggestions hiện ra:

   🟢 Best: //*[@resource-id="com.twitter.android:id/login_identifier"]
   🔵 Good: //android.widget.EditText[@clickable="true"]

6. Copy XPath "Best" (thường stable nhất)
```

#### **Cách 2: Manual Click (nếu cần)**
```
1. Click "Start Inspecting"
2. Screenshot LDPlayer hiện ra
3. Click vào username input field trên screenshot
4. XPath suggestions hiện ra
5. Copy XPath tốt nhất
```

### 4. Tìm XPath cho Next Button

**Auto-Search:**
```
Search: "next"
Results:
  "Next" (Button)
  com.twitter.android:id/cta_button

XPath: //*[@resource-id="com.twitter.android:id/cta_button"]
Hoặc: //*[@text="Next"]
```

### 5. Tìm XPath cho Password Field

**Auto-Search:**
```
Search: "password"
Results:
  (no text) EditText
  com.twitter.android:id/password_field

XPath: //*[@resource-id="com.twitter.android:id/password_field"]
```

### 6. Tìm XPath cho Login Button

**Auto-Search:**
```
Search: "log in"
Results:
  "Log in" (Button)
  com.twitter.android:id/login_button

XPath: //*[@resource-id="com.twitter.android:id/login_button"]
Hoặc: //*[@text="Log in"]
```

## 🎯 Bước 2: Thay XPath vào Template

### Template đơn giản (`x-login-simple.js`):

```javascript
// TRƯỚC (Template gốc):
const USERNAME_XPATH = '//*[@resource-id="com.twitter.android:id/login_identifier"]';
const NEXT_BUTTON_XPATH = '//*[@text="Next"]';
const PASSWORD_XPATH = '//*[@resource-id="com.twitter.android:id/password_field"]';
const LOGIN_BUTTON_XPATH = '//*[@text="Log in"]';

// SAU (Thay bằng XPath bạn tìm được):
const USERNAME_XPATH = '//*[@resource-id="com.twitter.android:id/ocf_input_session_id"]';
const NEXT_BUTTON_XPATH = '//*[@resource-id="com.twitter.android:id/ocf_button"]';
const PASSWORD_XPATH = '//*[@resource-id="com.twitter.android:id/ocf_input_password"]';
const LOGIN_BUTTON_XPATH = '//android.widget.Button[@text="Log in"]';
```

### Thay username/password:

```javascript
const USERNAME = 'myemail@gmail.com';  // Thay bằng email của bạn
const PASSWORD = 'MySecurePass123';     // Thay bằng password của bạn
```

## 🎯 Bước 3: Chạy Script

### Cách 1: Paste trực tiếp vào Script Tab
```
1. Mở Profile Details
2. Vào tab "Script"
3. Paste script đã sửa XPath
4. Click "Run Script"
```

### Cách 2: Save vào Profile
```
1. Mở Profile Details
2. Tab "Script"
3. Paste script
4. Click "Save"
5. Tab "General" → Click "Launch" (sẽ auto-run script)
```

### Cách 3: API Call
```javascript
POST http://localhost:5051/api/direct/execute
{
  "profileId": 1,
  "scriptCode": "// paste script here"
}
```

## 💡 Tips & Tricks

### Tip 1: Ưu tiên XPath theo thứ tự
```
1. 🟢 Best:   //*[@resource-id="..."]          (Unique resource-id)
2. 🔵 Good:   //*[@text="..."]                 (Unique text)
3. 🟡 Fair:   //Button[@text="..." and @clickable="true"]
4. ⚪ Low:    //android.widget.Button[2]       (Index - dễ thay đổi)
```

### Tip 2: Nếu XPath không tìm thấy element
```javascript
// Thử dùng contains() thay vì exact match
// Thay vì:
'//*[@text="Log in"]'

// Dùng:
'//*[contains(@text, "Log")]'
'//*[contains(@resource-id, "login")]'
```

### Tip 3: Debug khi script lỗi
```javascript
// Thêm log để xem element có tìm được không
const usernameEl = await helpers.findElementByXPath(USERNAME_XPATH);

if (!usernameEl) {
  log('❌ Không tìm thấy username field!');
  log('XPath đang dùng: ' + USERNAME_XPATH);
  throw new Error('Element not found');
}

log(`✅ Tìm thấy element tại (${usernameEl.center.x}, ${usernameEl.center.y})`);
```

### Tip 4: Thêm delay nếu app chạy chậm
```javascript
// Sau khi click Next, nếu app load chậm:
await helpers.sleep(5000);  // Đợi 5 giây thay vì 3 giây
```

## 📝 Ví dụ hoàn chỉnh

### XPath tìm được từ UI Inspector:
```
Username Field:
  🟢 //*[@resource-id="com.twitter.android:id/ocf_input_session_id"]
  🔵 //android.widget.EditText[@clickable="true"]

Next Button:
  🟢 //*[@resource-id="com.twitter.android:id/ocf_button"]
  🔵 //*[@text="Next"]

Password Field:
  🟢 //*[@resource-id="com.twitter.android:id/ocf_input_password"]

Login Button:
  🟢 //*[@resource-id="com.twitter.android:id/ocf_button_login"]
  🔵 //*[@text="Log in"]
```

### Script hoàn chỉnh:
```javascript
const USERNAME = 'myuser@gmail.com';
const PASSWORD = 'MyPassword123';

const USERNAME_XPATH = '//*[@resource-id="com.twitter.android:id/ocf_input_session_id"]';
const NEXT_BUTTON_XPATH = '//*[@resource-id="com.twitter.android:id/ocf_button"]';
const PASSWORD_XPATH = '//*[@resource-id="com.twitter.android:id/ocf_input_password"]';
const LOGIN_BUTTON_XPATH = '//*[@resource-id="com.twitter.android:id/ocf_button_login"]';

log('Đăng nhập X...');

// Nhập username
const usernameEl = await helpers.findElementByXPath(USERNAME_XPATH);
if (!usernameEl) throw new Error('Không tìm thấy username field');
await helpers.tap(usernameEl.center.x, usernameEl.center.y);
await helpers.sleep(500);
await helpers.inputText(USERNAME);
await helpers.sleep(1000);

// Click Next
const nextBtn = await helpers.findElementByXPath(NEXT_BUTTON_XPATH);
if (!nextBtn) throw new Error('Không tìm thấy Next button');
await helpers.tap(nextBtn.center.x, nextBtn.center.y);
await helpers.sleep(3000);

// Nhập password
const passwordEl = await helpers.findElementByXPath(PASSWORD_XPATH);
if (!passwordEl) throw new Error('Không tìm thấy password field');
await helpers.tap(passwordEl.center.x, passwordEl.center.y);
await helpers.sleep(500);
await helpers.inputText(PASSWORD);
await helpers.sleep(1000);

// Click Login
const loginBtn = await helpers.findElementByXPath(LOGIN_BUTTON_XPATH);
if (!loginBtn) throw new Error('Không tìm thấy Login button');
await helpers.tap(loginBtn.center.x, loginBtn.center.y);
await helpers.sleep(5000);

log('✅ Hoàn thành đăng nhập!');
```

## 🚀 Kết luận

**Workflow:**
1. Mở app → Màn hình đăng nhập
2. Inspector → Auto-Search → Tìm XPath
3. Copy XPath vào template
4. Thay username/password
5. Run script
6. Done!

**Thời gian:** ~5-10 phút để setup, sau đó tái sử dụng mãi mãi! 🎉
