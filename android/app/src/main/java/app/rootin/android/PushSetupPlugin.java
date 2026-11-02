package app.rootin.android;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Whether this build has Firebase (android/app/google-services.json at build
// time). Registering for pushes without it crashes the app, so lib/push.ts
// asks first. The google-services plugin leaves a google_app_id string.
@CapacitorPlugin(name = "PushSetup")
public class PushSetupPlugin extends Plugin {
    @PluginMethod
    public void ready(PluginCall call) {
        int id = getContext().getResources().getIdentifier("google_app_id", "string", getContext().getPackageName());
        JSObject result = new JSObject();
        result.put("ready", id != 0);
        call.resolve(result);
    }
}
