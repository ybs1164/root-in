package app.rootin.android;

import android.content.Intent;
import android.content.pm.verify.domain.DomainVerificationManager;
import android.content.pm.verify.domain.DomainVerificationUserState;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AppLinks")
public class AppLinksPlugin extends Plugin {
    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = new JSObject();
        // Android 12+ sends unapproved web links straight to the browser.
        // Older versions have no equivalent per-domain user-state API.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            result.put("enabled", JSObject.NULL);
            call.resolve(result);
            return;
        }
        try {
            String host = call.getString("host");
            if (host == null || host.isEmpty()) {
                call.reject("링크 주소가 없어요.");
                return;
            }
            DomainVerificationManager manager = getContext().getSystemService(DomainVerificationManager.class);
            DomainVerificationUserState state = manager.getDomainVerificationUserState(getContext().getPackageName());
            Integer hostState = state == null ? null : state.getHostToStateMap().get(host);
            boolean approved = hostState != null &&
                (hostState == DomainVerificationUserState.DOMAIN_STATE_VERIFIED ||
                 hostState == DomainVerificationUserState.DOMAIN_STATE_SELECTED);
            result.put("enabled", state != null && state.isLinkHandlingAllowed() && approved);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("앱 링크 설정을 확인하지 못했어요.", error);
        }
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Uri packageUri = Uri.parse("package:" + getContext().getPackageName());
            Intent intent = new Intent(Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                ? Settings.ACTION_APP_OPEN_BY_DEFAULT_SETTINGS
                : Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("링크 설정을 열지 못했어요.", error);
        }
    }
}
