package cl.cekother.tvchile;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.HashMap;

public class MainActivity extends Activity {
    // Origen https ficticio: los archivos salen de assets, nunca de la red.
    private static final String ORIGIN = "https://tvchile.local/";

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        setContentView(web);
        hideSystemBars();

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!uri.toString().startsWith(ORIGIN)) return null;
                String path = uri.getPath();
                if (path == null || path.equals("/")) path = "/index.html";
                try {
                    return new WebResourceResponse(mimeType(path), null, getAssets().open(path.substring(1)));
                } catch (IOException e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found",
                            new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
                }
            }
        });
        web.loadUrl(ORIGIN);
    }

    private static String mimeType(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "text/javascript";
        if (path.endsWith(".png")) return "image/png";
        return "application/octet-stream";
    }

    private void hideSystemBars() {
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    // Traduce las teclas del control remoto a los códigos que entiende la app web.
    private static int webKeyCode(int keyCode) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_UP: return 38;
            case KeyEvent.KEYCODE_DPAD_DOWN: return 40;
            case KeyEvent.KEYCODE_DPAD_LEFT: return 37;
            case KeyEvent.KEYCODE_DPAD_RIGHT: return 39;
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_NUMPAD_ENTER: return 13;
            case KeyEvent.KEYCODE_CHANNEL_UP: return 427;
            case KeyEvent.KEYCODE_CHANNEL_DOWN: return 428;
            default:
                if (keyCode >= KeyEvent.KEYCODE_0 && keyCode <= KeyEvent.KEYCODE_9) {
                    return 48 + (keyCode - KeyEvent.KEYCODE_0);
                }
                return -1;
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getKeyCode() == KeyEvent.KEYCODE_BACK) {
            if (event.getAction() == KeyEvent.ACTION_UP) handleBack();
            return true;
        }
        int code = webKeyCode(event.getKeyCode());
        if (code == -1) return super.dispatchKeyEvent(event);
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            web.evaluateJavascript("window.tvKey && window.tvKey(" + code + ")", null);
        }
        return true;
    }

    @Override
    public void onBackPressed() {
        handleBack();
    }

    private void handleBack() {
        web.evaluateJavascript("window.tvBack ? window.tvBack() : false", closedMenu -> {
            if (!"true".equals(closedMenu)) finish();
        });
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
