package app.rootin.android;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * 사진 저장 in the big photo view: the photo goes into the gallery, under
 * Pictures/root-in. Android 10+ needs no permission for that (MediaStore);
 * older phones ask for storage once (WRITE_EXTERNAL_STORAGE, maxSdkVersion 28).
 */
@CapacitorPlugin(
    name = "PhotoSave",
    permissions = { @Permission(alias = "storage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }) }
)
public class PhotoSavePlugin extends Plugin {
    private static final String FOLDER = "root-in";

    @PluginMethod
    public void save(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "storageAnswered");
            return;
        }
        write(call);
    }

    @PermissionCallback
    private void storageAnswered(PluginCall call) {
        if (getPermissionState("storage") == PermissionState.GRANTED) write(call);
        else call.reject("사진첩에 저장할 권한이 없어요.");
    }

    private void write(PluginCall call) {
        String data = call.getString("data");
        String name = call.getString("name", "root-in.jpg");
        if (data == null) {
            call.reject("사진을 읽을 수 없어요.");
            return;
        }
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            String mime = name.endsWith(".png") ? "image/png" : name.endsWith(".webp") ? "image/webp" : name.endsWith(".gif") ? "image/gif" : "image/jpeg";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, name);
                values.put(MediaStore.Images.Media.MIME_TYPE, mime);
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/" + FOLDER);
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
                Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new IllegalStateException("no gallery entry");
                try (OutputStream out = resolver.openOutputStream(uri)) {
                    if (out == null) throw new IllegalStateException("no gallery stream");
                    out.write(bytes);
                } catch (Exception error) {
                    resolver.delete(uri, null, null);
                    throw error;
                }
                values.clear();
                values.put(MediaStore.Images.Media.IS_PENDING, 0);
                // Only shown in the gallery once it's no longer pending: that's the save done.
                if (resolver.update(uri, values, null, null) < 1) {
                    resolver.delete(uri, null, null);
                    throw new IllegalStateException("gallery entry not published");
                }
            } else {
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), FOLDER);
                if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("no folder");
                File file = new File(dir, name);
                try (FileOutputStream out = new FileOutputStream(file)) {
                    out.write(bytes);
                }
                if (file.length() != bytes.length) throw new IllegalStateException("short write");
                MediaScannerConnection.scanFile(getContext(), new String[] { file.getAbsolutePath() }, new String[] { mime }, null);
            }
            call.resolve();
        } catch (Exception error) {
            call.reject("사진을 저장하지 못했어요.", error);
        }
    }
}
