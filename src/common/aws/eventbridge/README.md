# AWS EventBridge Entegrasyonu

Bu modül, AWS EventBridge ile cron job'ları yönetmek ve SQS'ye mesaj göndermek için gerekli servisleri sağlar.

## Özellikler

- ✅ EventBridge'de cron job (rule) oluşturma
- ✅ SQS target ekleme
- ✅ Cron job'ları yönetme (oluştur, güncelle, sil, etkinleştir/devre dışı bırak)
- ✅ Custom event gönderme
- ✅ REST API endpoint'leri

## Gereksinimler

### Environment Variables

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_ACCOUNT_ID=your-account-id
AWS_EVENTBRIDGE_ROLE_ARN=arn:aws:iam::ACCOUNT_ID:role/EventBridgeSQSRole  # Opsiyonel ama önerilir
```

### IAM Role (EventBridge → SQS için)

EventBridge'in SQS'ye mesaj gönderebilmesi için bir IAM role oluşturmanız gerekiyor:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:SendMessage"
      ],
      "Resource": "arn:aws:sqs:REGION:ACCOUNT_ID:QUEUE_NAME"
    }
  ]
}
```

Trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "events.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

## Kullanım

### 1. Cron Job Oluşturma

#### REST API ile:

```bash
POST /eventbridge/cron-jobs
Content-Type: application/json

{
  "ruleName": "morning-reminder",
  "description": "Sabah hatırlatması",
  "cronExpression": "cron(0 9 ? * MON-FRI *)",
  "queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789012/my-queue",
  "messageBody": {
    "type": "morning-reminder",
    "timestamp": "2026-01-29T09:00:00Z"
  },
  "enabled": true
}
```

#### Kod ile:

```typescript
import { EventBridgeCronService } from './common/aws/eventbridge/eventbridge-cron.service';

constructor(private readonly eventBridgeCronService: EventBridgeCronService) {}

async createJob() {
  await this.eventBridgeCronService.createOrUpdateCronJob({
    ruleName: 'morning-reminder',
    description: 'Sabah hatırlatması',
    cronExpression: 'cron(0 9 ? * MON-FRI *)',
    queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
    messageBody: {
      type: 'morning-reminder',
      timestamp: new Date().toISOString(),
    },
    enabled: true,
  });
}
```

### 2. Yaygın Cron Job'ları Oluşturma

```bash
POST /eventbridge/cron-jobs/common
Content-Type: application/json

{
  "queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789012/my-queue"
}
```

Bu endpoint şu cron job'ları oluşturur:
- `morning-reminder`: Her gün 09:00 (Hafta içi)
- `evening-reminder`: Her gün 17:45 (Hafta içi)
- `daily-reset`: Her gün 00:00

### 3. Cron Job Listeleme

```bash
GET /eventbridge/cron-jobs
GET /eventbridge/cron-jobs?prefix=morning  # Prefix ile filtreleme
```

### 4. Cron Job Detayları

```bash
GET /eventbridge/cron-jobs/:ruleName
```

### 5. Cron Job Güncelleme

```bash
PUT /eventbridge/cron-jobs/:ruleName
Content-Type: application/json

{
  "cronExpression": "cron(0 10 ? * MON-FRI *)",
  "description": "Güncellenmiş açıklama",
  "enabled": true
}
```

### 6. Cron Job Silme

```bash
DELETE /eventbridge/cron-jobs/:ruleName
```

### 7. Cron Job Etkinleştirme/Devre Dışı Bırakma

```bash
PUT /eventbridge/cron-jobs/:ruleName/enable
PUT /eventbridge/cron-jobs/:ruleName/disable
```

### 8. Custom Event Gönderme

```bash
POST /eventbridge/events
Content-Type: application/json

{
  "source": "com.myapp.custom",
  "detailType": "Custom Event",
  "detail": {
    "key": "value",
    "timestamp": "2026-01-29T10:00:00Z"
  }
}
```

## Cron Expression Formatı

AWS EventBridge cron formatı:

```
cron(minute hour day-of-month month day-of-week year)
```

Örnekler:

- `cron(0 9 ? * MON-FRI *)` - Hafta içi her gün 09:00
- `cron(45 17 ? * MON-FRI *)` - Hafta içi her gün 17:45
- `cron(0 0 * * ? *)` - Her gün 00:00
- `cron(0 12 ? * * *)` - Her gün 12:00
- `cron(0 0 1 * ? *)` - Her ayın 1'i 00:00

**Not:** `?` karakteri "herhangi bir değer" anlamına gelir ve day-of-month veya day-of-week'ten biri için kullanılmalıdır.

## SQS Mesaj Formatı

EventBridge'den SQS'ye gönderilen mesajlar şu formatta olur:

```json
{
  "version": "0",
  "id": "event-id",
  "detail-type": "Scheduled Event",
  "source": "aws.events",
  "account": "123456789012",
  "time": "2026-01-29T09:00:00Z",
  "region": "us-east-1",
  "resources": ["arn:aws:events:us-east-1:123456789012:rule/morning-reminder"],
  "detail": {
    // InputTransformer ile belirtilen mesaj body buraya gelir
    "type": "morning-reminder",
    "timestamp": "2026-01-29T09:00:00Z"
  }
}
```

## SQS'den Mesaj Okuma

SQS'den mesajları okumak için mevcut `SqsService`'i kullanabilirsiniz:

```typescript
import { SqsService } from './common/aws/sqs/sqs.service';

constructor(private readonly sqsService: SqsService) {}

async processMessages() {
  const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue';
  
  const messages = await this.sqsService.receiveMessages(queueUrl);
  
  for (const message of messages) {
    const body = JSON.parse(message.Body || '{}');
    const detail = JSON.parse(body.detail || '{}');
    
    this.logger.log('Event type:', detail.type);
    this.logger.log('Timestamp:', detail.timestamp);
    
    // Mesajı işle
    await this.processEvent(detail);
    
    // Mesajı sil
    await this.sqsService.deleteMessage(queueUrl, message.ReceiptHandle!);
  }
}
```

## Hata Yönetimi

Tüm servis metodları hata durumunda exception fırlatır. Hataları yakalamak için try-catch kullanın:

```typescript
try {
  await this.eventBridgeCronService.createOrUpdateCronJob(config);
} catch (error) {
  this.logger.error('Cron job oluşturulamadı:', error.message);
}
```

## Logging

Tüm işlemler logger ile loglanır. Log seviyesini NestJS yapılandırmasından ayarlayabilirsiniz.

## Örnek Kullanım Senaryosu

1. SQS queue oluştur:
   ```bash
   aws sqs create-queue --queue-name my-scheduled-jobs
   ```

2. IAM role oluştur (EventBridge → SQS için)

3. Cron job oluştur:
   ```bash
   POST /eventbridge/cron-jobs
   {
     "ruleName": "daily-report",
     "cronExpression": "cron(0 8 ? * MON-FRI *)",
     "queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789012/my-scheduled-jobs",
     "messageBody": {
       "type": "daily-report",
       "date": "2026-01-29"
     }
   }
   ```

4. SQS'den mesajları oku ve işle (worker service'te)

## Notlar

- EventBridge cron job'ları UTC saatine göre çalışır
- Timezone ayarlamak için cron expression'da saat farkını hesaplayın
- IAM role olmadan da çalışabilir ancak AWS konsol üzerinden manuel olarak izin vermeniz gerekebilir
- EventBridge ücretsiz tier'da ayda 1 milyon event'e kadar ücretsizdir




