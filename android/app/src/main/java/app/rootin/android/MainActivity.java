package app.rootin.android;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocationSettingsPlugin.class);
        registerPlugin(AppLinksPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
