# 공유·초대 링크와 앱 열기

현재 공개 주소는 `https://ybs1164.github.io/root-in/`이다. 기존 `#s=`(짧은 코스),
`#share=`(긴 코스), `#c=`(카테고리), `#g=`(그룹 초대) 형식을 유지한다.

- Android/iOS 앱은 `rootin://open?g=<slug>` 등의 주소를 받는다. Android 웹은 패키지를
  지정한 `intent://`를, iOS 웹은 `rootin://`를 사용한다.
- 모바일 웹은 앱 실행을 한 번 시도하고 **앱에서 열기 / 웹에서 계속**을 보여준다.
  `_rootin_web=1`은 자동 실행을 다시 시도하지 않도록 하는 표시다. Android Intent의
  웹 fallback에도 이 표시와 원래 공유 내용을 담아 리디렉션 반복을 막는다.
- 웹에서 계속하기 전에는 앱 본체를 마운트하지 않는다. 앱으로 넘어갈 그룹 초대를
  브라우저의 다른 계정으로 먼저 수락하는 것을 방지한다.
- 앱은 시작 시 `App.getLaunchUrl()`과 실행 중 `appUrlOpen`을 함께 처리한다.
  받은 내용은 로컬 WebView의 fragment로만 옮기고 기존 URL 처리기를 호출한다.
  외부 웹 페이지로 WebView를 이동하거나 인증 토큰·임의 쿼리를 옮기지 않는다.
- HTTPS 링크는 `VITE_PUBLIC_APP_URL`의 출처와 기본 경로가 일치해야 받는다.
  Android의 HTTP/HTTPS 필터는 현재 공개 호스트와 `/root-in/` 경로로 제한했다.
  공개 주소를 바꿀 때에는 이 필터도 바꾼다.

Android 12 이상에서 초대가 웹으로만 열리면 **앱 설정 → 초대 링크 연결 → 앱 링크 설정 열기**에서
**지원되는 링크 열기**를 켜고 `ybs1164.github.io`을 선택한다. We Now에도 연결이 꺼져 있을 때
같은 설정 버튼을 표시한다. 앱으로 돌아오면 Android의 실제 도메인 승인 상태를 다시 읽는다.
이 설정은 기존 설치본의 실패한 도메인 검증이나 사용자가 꺼 둔 링크 연결을 복구하는 경로다.
앱에서 시스템의 사용자 선택을 강제로 바꾸지 않는다. 이미 설치된 앱 위에 새 APK를 업데이트하면
로컬 계정과 데이터가 유지된다. 계정을 유지하려면 기존 앱을 삭제하지 않는다.

## HTTPS 링크를 누르자마자 앱이 열리게 하려면

**현재 변경만으로 검증된 App Links / Universal Links 배포가 완료되지는 않는다.**
브라우저는 사용자 동작 없는 앱 실행을 제한할 수 있다. 이때 **앱에서 열기**를 누른다.
앱이 없으면 **웹에서 계속**을 누른다. 마켓 주소는 아직 설정하지 않는다.

자동 실행을 브라우저 경유 없이 보장하려면 호스트 루트의 검증 파일과 배포 앱의 서명이 필요하다.
이 프로젝트 Pages는 `/root-in/`에 배포되므로 `public/.well-known/`을 추가해도
`https://ybs1164.github.io/.well-known/`에 배포되지 않는다. 호스트 루트를 제공하는
`ybs1164.github.io` 저장소 또는 직접 관리하는 도메인에서 아래 파일을 제공해야 한다.

Android:

로컬 호스트 저장소 `N:/Projects/ybs1164.github.io/.well-known/assetlinks.json`에
기존 앱 등록을 보존하고 `app.rootin.android` 등록을 추가했다. 지문은 이 PC의
`~/.android/debug.keystore`에서 읽은 테스트 APK 인증서다
(`CD:D4:8B:28:2E:EB:77:53:13:FB:18:B3:72:C6:19:18:B8:AF:F7:CD:CE:5D:E5:1A:B2:0D:1C:AD:DC:CD:3A:DF`).
이 파일을 호스트에 배포하고 새 APK를 설치하면 테스트 앱의 도메인을 검증할 수 있다.
호스트 저장소의 이 변경도 함께 배포해야 Android 도메인 검증이 적용된다.

1. 실제 배포 앱의 서명 인증서 SHA-256 지문(Play 배포라면 Play App Signing 인증서)을 확인한다.
2. `https://ybs1164.github.io/.well-known/assetlinks.json`에 다음 JSON을 올린다.
   `ACTUAL_SIGNING_CERT_SHA256`에는 실제 지문을 넣는다. 디버그·릴리스 인증서는 별개다.

   ```json
   [{
     "relation": ["delegate_permission/common.handle_all_urls"],
     "target": {
       "namespace": "android_app",
       "package_name": "app.rootin.android",
       "sha256_cert_fingerprints": ["ACTUAL_SIGNING_CERT_SHA256"]
     }
   }]
   ```

3. 새 APK 설치 후 도메인 검증을 확인한다. 앱에는 `autoVerify` 필터가 들어 있다.

   ```sh
   adb shell pm verify-app-links --re-verify app.rootin.android
   adb shell pm get-app-links app.rootin.android
   ```

iOS:

1. 배포 Apple 팀의 App ID prefix를 확인한다.
2. `App/App.entitlements`에 `applinks:ybs1164.github.io`를 등록하고 Debug/Release의
   `CODE_SIGN_ENTITLEMENTS`에 연결했다. 해당 기능을 포함한 provisioning profile로 빌드한다.
   공개 주소를 바꿀 때에는 이 entitlement도 바꾼다.
3. `https://ybs1164.github.io/.well-known/apple-app-site-association`에 다음 JSON을
   리디렉션 없이 `application/json`으로 제공한다. `ACTUAL_APP_ID_PREFIX`를 실제 값으로 바꾼다.

   ```json
   {
     "applinks": {
       "details": [{
         "appIDs": ["ACTUAL_APP_ID_PREFIX.app.rootin.ios"],
         "components": [{ "/": "/root-in/" }, { "/": "/root-in" }]
       }]
     }
   }
   ```

## 확인

새 네이티브 설정과 JS가 모두 들어간 앱을 설치해야 한다. 예전 설치본에는 Scheme이 없다.
`npm run android:sync` 후 `npm run android:apk`, iOS는 `npm run ios:sync` 후 Xcode에서 빌드한다.
웹 변경도 Pages에 배포해야 현재 HTTPS 링크에서 실행된다.

```sh
# Android: 앱을 끈 상태와 이미 켠 상태 각각 실행 (실제 유효한 slug로 교체)
adb shell am start -W -a android.intent.action.VIEW -d 'rootin://open?g=abcdefghij' app.rootin.android
# iOS 시뮬레이터 (macOS)
xcrun simctl openurl booted 'rootin://open?g=abcdefghij'
```

모바일 브라우저에서 공유 링크 진입, 앱에서 열기, 웹에서 계속, 미설치 fallback,
같은 링크 다시 열기, 다른 링크 연속 열기를 확인한다. 단위 테스트는 신뢰 출처/경로,
Intent 인코딩, 코스 토큰 왕복, cold/warm 전달과 시작 시 경합을 검사한다.

근거: [Capacitor App API](https://capacitorjs.com/docs/apis/app),
[Chrome Android Intents](https://developer.chrome.com/docs/android/intents),
[Android App Links 검증](https://developer.android.com/training/app-links/verify-applinks),
[Apple Associated Domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains).
