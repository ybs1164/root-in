package app.rootin.android;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// The launcher icon follows the app theme (설정 → 디스플레이): one launcher
// alias per theme in AndroidManifest.xml, exactly one enabled. Swapping aliases
// while the app is in front can close it on some launchers, so the switch waits
// until the app goes to the background (handleOnPause).
@CapacitorPlugin(name = "AppIcon")
public class AppIconPlugin extends Plugin {
    private static final String[] THEMES = { "matcha", "banana", "choco", "strawberry" };
    private String pending = null;

    @PluginMethod
    public void set(PluginCall call) {
        String name = call.getString("name", "matcha");
        boolean known = false;
        for (String theme : THEMES) known |= theme.equals(name);
        pending = known ? name : "matcha";
        call.resolve();
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        if (pending == null) return;
        apply(getContext(), pending);
        pending = null;
    }

    private static ComponentName alias(Context context, String theme) {
        String suffix = theme.substring(0, 1).toUpperCase() + theme.substring(1);
        return new ComponentName(context.getPackageName(), "app.rootin.android.Icon" + suffix);
    }

    private static void apply(Context context, String name) {
        PackageManager pm = context.getPackageManager();
        // Enable the new one first, so the app never has no launcher entry.
        pm.setComponentEnabledSetting(alias(context, name), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
        for (String theme : THEMES) {
            if (theme.equals(name)) continue;
            pm.setComponentEnabledSetting(alias(context, theme), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
        }
    }
}
