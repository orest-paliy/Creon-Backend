# 📘 CreON Backend

> API сервісу для візуального пошуку ідей і рішень з використанням генеративного штучного інтелекту.

---

## 👤 Автор

* **ПІБ**: Палій Орест Андрійович
* **Група**: ФЕІ-42
* **Керівник**: Стахіра Роман Йосипович, доцент
* **Дата виконання**: 01.06.2025

---

## 📌 Загальна інформація

* **Тип проєкту**: Серверна логіка (Backend)
* **Мова програмування**: TypeScript
* **Технології**: Firebase Cloud Functions, Firebase Realtime Database, Cloud Storage, Pinecone, OpenAI API, Google Cloud Vision API

---

## 🧠 Опис функціоналу

* ☁️ Завантаження та збереження зображень у Firebase Storage
* 📝 Генерація автоматичних текстових описів зображень (OpenAI GPT-4o)
* 📊 Формування семантичних embedding-векторів на основі текстових описів (textembedding3)
* 🛡️ Автоматична модерація контенту зображень (Google Cloud Vision API, SafeSearch)
* 🗂️ Зберігання метаданих у Firebase Realtime Database та embedding-векторів у Pinecone DB
* 🔗 REST API для взаємодії з мобільними застосунками (iOS та Android)
* 🔍 Реалізація системи семантичного пошуку

---

## 🧱 Основні файли та модулі

| Файл / Модуль         | Призначення                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `index.ts`            | Точка входу та реєстрація HTTP-функцій                                  |
| `postLogic.ts`        | Логіка роботи з публікаціями                                            |
| `gptTagLogic.ts`      | Взаємодія з OpenAI API (генерація тегів)                                |
| `visionModeration.ts` | Перевірка безпечності контенту (Google API)                             |
| `userLogic.ts`        | Логіка роботи з профілями користувачів                                  |
| `commentsLogic.ts`    | Робота з коментарями                                                    |
| `Firebase Secrets`    | Безпечне зберігання API-ключів у продакшн-середовищі через Firebase CLI |

---

## ▶️ Інструкція із запуску

### 1. Встановлення інструментів

* Node.js v20.x або вище
* Firebase CLI (`npm install -g firebase-tools`)

### 2. Клонування репозиторію

git clone https://github.com/orest-paliy/Creon-Backend.git


### 3. Встановлення залежностей

npm install

### 4. Створення та налаштування сервісів

#### Створення Firebase проекту

1. Перейдіть на [Firebase Console](https://console.firebase.google.com/) і створіть новий проект.

#### Створення індексу Pinecone

1. Зареєструйтесь на [Pinecone](https://www.pinecone.io/) та створіть новий індекс для зберігання векторів.
2. Отримайте API-ключ Pinecone для інтеграції з вашим проєктом.

#### Підключення Google Vision API

1. Активуйте [Google Cloud Vision API](https://console.cloud.google.com/apis/library/vision.googleapis.com) у Google Cloud Console для створеного Firebase проєкту.

#### Підключення OpenAI API

1. Зареєструйтеся на платформі [OpenAI API](https://platform.openai.com/api-keys) та створіть новий API-ключ.

#### Створення API-ключів

Створіть та налаштуйте API-ключі через Firebase Secrets:
firebase functions:secrets:set OPENAI_KEY
firebase functions:secrets:set PINECONE_API_KEY

У коді доступ до секретів реалізується за допомогою `defineSecret()` та `setSecret()`.

### 5. Деплой функцій

firebase deploy --only functions
або firebase deploy --only functions:FUNCTION_NAME для деплою конкретної функції

---

## 🔌 API приклади

### 🖼️ Генерація опису і тегів

**POST** `/generate-description`

```json
{
  "imageUrl": "https://firebase.storage.com/image.png"
}
```

**Response:**

```json
{
  "description": "Дерев’яний олівець чорного кольору на білому аркуші."
}
```

### 🔍 Семантичний пошук

**POST** `/search-similar`

```json
{
  "query": "олівець на папері",
  "limit": 10
}
```

**Response:**

```json
{
  "results": [
    { "id": "12345", "similarity": 0.95 },
    { "id": "67890", "similarity": 0.93 }
  ]
}
```

---

## 🧪 Вирішення поширених проблем

| Проблема                                                               | Рішення                                                                                                                                                                                                    |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API повертає помилку авторизації                                       | Перевірте правильність конфігурації Firebase Secrets (у продакшн)                                                                                                                                          |
| Функції не деплояться                                                  | Перевірте налаштування Firebase у файлі firebase.json                                                                                                                                                      |
| Не проходить модерація контенту                                        | Перевірте стан Google Vision API у консолі Google Cloud                                                                                                                                                    |
| API-ключі OpenAI або Pinecone не розпізнаються функціями               | Переконайтеся, що ви правильно встановили секрети. Перевірте, чи відповідають імена змінних у коді тим, що встановлені як секрети.                                                                         |
| Семантичний пошук повертає порожні результати або помилки              | Переконайтеся, що індекс Pinecone був створений та правильно налаштований, і що API-ключ Pinecone є дійсним. Перевірте, чи були додані embedding-вектори до індексу Pinecone після завантаження зображень. |
| Функції Firebase не запускаються або видають помилки під час виконання | Переконайтеся, що ви встановили Node.js версії 20.x або вище. Перевірте логи Cloud Functions у Firebase Console на наявність детальніших помилок виконання.                                                |

---

## 🧾 Використані джерела

* Firebase Functions [документація](https://firebase.google.com/docs/functions)
* OpenAI [API docs](https://platform.openai.com/docs)
* Pinecone [документація](https://www.pinecone.io/docs)
* Google Cloud Vision API [документація](https://cloud.google.com/vision/docs)

---
