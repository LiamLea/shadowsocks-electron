import React, { useEffect, useState } from "react";
import { CssBaseline } from "@material-ui/core";
import {
  makeStyles,
  createStyles,
  createMuiTheme,
  Theme,
  ThemeProvider
} from "@material-ui/core/styles";
import {
  HashRouter,
  Switch,
  Route,
  Redirect
} from "react-router-dom";
import { MessageChannel } from 'electron-re';
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { ipcRenderer } from "electron";
import AppNav from "./components/AppNav";
import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";
import AboutPage from "./pages/AboutPage";
import { store, persistor } from "./redux/store";
import Loading from "./components/Loading";
import { SET_STATUS } from "./redux/actions/status";
import prepareForLanguage from './i18n';
import { getDefaultLang } from "./utils";

const mainTheme = createMuiTheme({
  spacing: 8,
  palette: {
    secondary: {
      main: "#fff"
    }
  }
});

const darkTheme = createMuiTheme({
  spacing: 8,
  palette: {
    type: "dark",
    primary: {
      main: "#1769aa"
    },
    secondary: {
      main: "#424242"
    }
  }
});

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      display: "flex"
    },
    toolbar: theme.mixins.toolbar,
    content: {
      flexGrow: 1
    }
  })
);

ipcRenderer.on("connected", (e, message) => {
  store.dispatch({
    type: SET_STATUS,
    key: "connected",
    value: message
  });
});

prepareForLanguage(getDefaultLang());

const App: React.FC = () => {
  const styles = useStyles();

  const [darkMode] = useState(false);

  useEffect(() => {
    MessageChannel.invoke('main','service:main', {
      action: 'isConnected',
      params: {}
    }).then(rsp => {
      if (rsp.code === 200) {
        store.dispatch({
          type: SET_STATUS,
          key: "connected",
          value: rsp.result
        });
      }
    });
  }, []);

  return (
    <Provider store={store}>
      <PersistGate loading={<Loading />} persistor={persistor}>
        <ThemeProvider theme={darkMode ? darkTheme : mainTheme}>
          <HashRouter>
            <div className={styles.root}>
              <CssBaseline />
              <AppNav />
              <main className={styles.content}>
                <div className={styles.toolbar} />
                <Switch>
                  <Route path="/home">
                    <HomePage />
                  </Route>
                  <Route path="/settings">
                    <SettingsPage />
                  </Route>
                  <Route path="/about">
                    <AboutPage />
                  </Route>
                  <Redirect to="/home" />
                </Switch>
              </main>
            </div>
          </HashRouter>
        </ThemeProvider>
      </PersistGate>
    </Provider>
  );
};

export default App;