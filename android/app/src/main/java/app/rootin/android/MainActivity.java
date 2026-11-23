package app.rootin.android;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocationSettingsPlugin.class);
        registerPlugin(AppLinksPlugin.class);
        registerPlugin(PushSetupPlugin.class);
        registerPlugin(AppIconPlugin.class);
        registerPlugin(PhotoSavePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
