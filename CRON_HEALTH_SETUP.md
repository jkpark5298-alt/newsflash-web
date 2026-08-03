# NewsFlash 백그라운드 푸시 cron 설정

앱(PWA)이 닫혀 있어도 키워드/정기 알림이 가려면 서버가 주기적으로 아래 URL을 호출해야 합니다.

```txt
https://newsflash-web-seven.vercel.app/api/send-scheduled-push
```

## 1) GitHub Actions (권장, 5분마다)

이 저장소의 `.github/workflows/scheduled-push.yml`이 5분마다 위 URL을 호출합니다.

필수 설정:

1. GitHub 저장소 → **Settings → Secrets and variables → Actions**
2. **New repository secret**
   - Name: `CRON_SECRET`
   - Value: Vercel 프로젝트의 `CRON_SECRET`과 **동일한 값**
3. (선택) Variables에 `PUSH_CRON_URL`을 두면 URL을 바꿀 수 있습니다.
4. **Actions** 탭에서 `Scheduled Push Cron` → **Run workflow**로 즉시 1회 테스트

> 참고: GitHub schedule은 부하 시 수 분 지연될 수 있습니다.

## 2) Vercel Cron (Hobby 보완)

Hobby 플랜은 하루 1회만 가능해서 `vercel.json`에는 KST 07:00(= UTC 22:00) 1회만 등록합니다.
자주 돌리려면 1번(GitHub Actions) 또는 3번(cron-job.org)을 사용하세요.

## 3) cron-job.org 대안

- URL: `https://newsflash-web-seven.vercel.app/api/send-scheduled-push`
- Method: GET
- Schedule: Every 5 minutes
- Timeout: 60 seconds
- Header: `Authorization: Bearer <CRON_SECRET>`
- 또는 `?secret=<CRON_SECRET>`

## 정상 동작 확인

1. iPhone 홈 화면 PWA → 알림 안내판 → 서버 구독 count ≥ 1
2. `/api/push-status`에서 `cronSecretConfigured: true`, `pushReady: true`
3. 알림 안내판의 **iPhone 푸시 연결 + 테스트 발송**
4. Actions 실행 후 `/api/push-status`의 `recentSentSlots` 갱신 확인

## 알림 종류

| 종류 | 조건 |
|------|------|
| 키워드 속보 | 구독자 `alertEnabled` + 키워드 매칭 (cron 주기마다 검사) |
| 정기 뉴스 | KST 07:00~23:00 매시 정각 (슬롯당 1회) |
| 정기 증시 | KST 07:00 / 12:00 / 16:00 (슬롯당 1회) |
