# ✅ Bugfix: TypeScript Build Error - recommendations array

## 🐛 Lỗi

```
error TS2345: Argument of type '"⚠️ DirectScriptService not initialized..."' is not assignable to parameter of type 'never'.
```

**Location:** `server/routes/index.ts:2608`

## 🔍 Nguyên Nhân

TypeScript infer type của `recommendations: []` là `never[]` thay vì `string[]`.

**Code lỗi:**
```typescript
const diagnostic = {
  systemStatus: { ... },
  profiles: [ ... ],
  summary: { ... },
  recommendations: []  // ❌ TypeScript infer: never[]
};

diagnostic.recommendations.push('...'); // ❌ Error: can't push string to never[]
```

## ✅ Giải Pháp

Thêm **type annotation** rõ ràng:

```typescript
const diagnostic = {
  systemStatus: { ... },
  profiles: [ ... ],
  summary: { ... },
  recommendations: [] as string[]  // ✅ Explicitly type as string[]
};

diagnostic.recommendations.push('...'); // ✅ OK now!
```

## 📁 File Đã Sửa

**`server/routes/index.ts`** (line 2603)

**Before:**
```typescript
recommendations: []
```

**After:**
```typescript
recommendations: [] as string[]
```

## 🧪 Test

```bash
# Check TypeScript errors
npx tsc --noEmit
# ✅ No errors

# Build full project
npm run build
# ✅ Build successful
```

## 📊 Build Result

```
✓ 2256 modules transformed
✓ Client built in 7.42s
✓ Server compiled successfully
✅ BUILD SUCCESS
```

---

**Status:** ✅ **FIXED**

TypeScript build error đã được sửa. Project build thành công!
