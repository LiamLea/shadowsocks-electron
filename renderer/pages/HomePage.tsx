import { MessageChannel } from 'electron-re';
import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import {
  Container,
  List,
  Fab,
  CircularProgress,
  Typography,
  Tabs,
  Tab
} from "@material-ui/core";
import { useTranslation } from 'react-i18next';
import { green, yellow } from "@material-ui/core/colors";
import AddIcon from "@material-ui/icons/Add";
import uuid from "uuid/v1";

import ServerListItem from "../components/ServerListItem";
import AddServerDialog from "../components/AddServerDialog";
import ConfShareDialog from '../components/ConfShareDialog';
import EditServerDialog from "../components/EditServerDialog";
import { Config, Mode, closeOptions } from "../types";
import { useTypedSelector } from "../redux/reducers";
import useSnackbarAlert from '../hooks/useSnackbarAlert';
import useDialogConfirm from '../hooks/useDialogConfirm';
import useBackDrop from '../hooks/useBackDrop';
import { addConfigFromClipboard, generateUrlFromConfig, getQrCodeFromScreenResources } from '../redux/actions/config';
import {
  ADD_CONFIG,
  EDIT_CONFIG,
  REMOVE_CONFIG
} from "../redux/actions/config";
import { SET_SETTING } from "../redux/actions/settings";
import { useStylesOfHome as useStyles } from "./styles";
import { openNotification } from '../utils';

const menuItems = ["PAC", "Global", "Manual"];

/**
 * HomePage
 * @returns React.FC
 */
const HomePage: React.FC = () => {
  const styles = useStyles();
  const { t } =  useTranslation();

  const dispatch = useDispatch();
  const config = useTypedSelector(state => state.config);
  const selectedServer = useTypedSelector(
    state => state.settings.selectedServer
  );
  const mode = useTypedSelector(state => state.settings.mode);
  const settings = useTypedSelector(state => state.settings);
  const connected = useTypedSelector(state => state.status.connected);

  const [loading, setLoading] = useState(false);
  const [SnackbarAlert, setSnackbarMessage] = useSnackbarAlert();
  const [DialogConfirm, showDialog, closeDialog] = useDialogConfirm();
  const [BackDrop, setBackDrop] = useBackDrop();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareData, setShareData] = useState({
    url: '',
    dataUrl: ''
  });
  const [editServerDialogOpen, setEditServerDialogOpen] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [removingServerId, setRemovingServerId] = useState<string | null>(null);

  {/* -------- functions ------- */}

  const handleModeChange = ((event: React.ChangeEvent<{}>, value: string) => {
    dispatch({
      type: SET_SETTING,
      key: "mode",
      value: value as Mode
    });
  });

  const handleServerSelect = (id: string) => {
    dispatch({
      type: SET_SETTING,
      key: "selectedServer",
      value: id
    });
  };

  const handleDialogOpen = () => {
    setDialogOpen(true);
  };

  const handleDialogClose = (selection?: closeOptions) => {
    switch (selection) {
      case 'manual':
        setDialogOpen(false);
        setEditServerDialogOpen(true);
        break;
      case 'qrcode':
        setBackDrop(true);
        dispatch(getQrCodeFromScreenResources((added: boolean) => {
          setTimeout(() => {
            setBackDrop(false);
            setSnackbarMessage(added ? t('added_a_server') : t('no_qr_code_is_detected') )
          }, .5e3);
        }));
        setDialogOpen(false);
        break;
      case 'url':
        setDialogOpen(false);
        setBackDrop(true);
        dispatch(addConfigFromClipboard((added: boolean) => {
          setTimeout(() => {
            setBackDrop(false);
            setSnackbarMessage(added ? t('added_a_server') : t('invalid_operation') )
          }, .5e3);
        }));
        break;
      case 'share':
        setShareDialogOpen(false);
        break;
      default:
        setDialogOpen(false);
        break;
    }
  };

  const handleEditServer = (values: Config | null) => {
    setEditServerDialogOpen(false);
    if (values) {
      if (!editingServerId) {
        dispatch({ type: ADD_CONFIG, config: values, id: uuid() });
        setSnackbarMessage(t("added_a_server"));
      } else {
        dispatch({
          type: EDIT_CONFIG,
          config: values,
          id: values.id
        });
        setSnackbarMessage(t("edited_a_server"));
      }
    }

    setEditingServerId(null);
  };

  const handleEditServerDialogClose = () => {
    setEditServerDialogOpen(false);
    setEditingServerId(null);
  };

  const handleServerConnect = async () => {
    if (selectedServer) {
      setLoading(true);

      if (connected) {
        await MessageChannel.invoke('main', 'service:main', {
          action: 'stopClient',
          params: {}
        });
      } else {
        await MessageChannel.invoke('main', 'service:main', {
          action: 'startClient',
          params: {
            config: config.find(i => i.id === selectedServer)!,
            settings
          }
        }).then(rsp => {
          if (rsp.code === 600 && rsp.result.isInUse) {
            openNotification({
              title: t('warning'),
              body: t('the_local_port_is_occupied'),
              urgency: 'low'
            });
          }
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      setLoading(false);
    }
  };

  const handleShareButtonClick = (id: string) => {
    const conf = config.find(item => item.id === id);
    if (!conf) return;
    setShareDialogOpen(true);
    generateUrlFromConfig(conf)
      .then(rsp => {
        if (rsp.code === 200) {
          setShareData({
            url: rsp.result.url,
            dataUrl: rsp.result.dataUrl
          });
        }
      });
  }

  const handleEditButtonClick = (id: string) => {
    setEditingServerId(id);
    setEditServerDialogOpen(true);
  };

  const handleRemoveButtonClick = (id: string) => {
    if (id === selectedServer) {
      setSnackbarMessage(t('cannot_remove_selected_server'));
      return;
    }

    setRemovingServerId(id);
    showDialog(t('remove_this_server?'), t('this_action_cannot_be_undone'));
  };

  const handleServerRemove = () => {
    dispatch({
      type: REMOVE_CONFIG,
      config: null as any,
      id: removingServerId!
    });
    setSnackbarMessage(t("removed_a_server"));

    closeDialog();
    setRemovingServerId(null);
  };

  const handleAlertDialogClose = () => {
    closeDialog()
    setRemovingServerId(null);
  };

  {/* -------- hooks ------- */}

  setInterval(() => {
    // MessageChannel.invoke('main', 'service:main', {
    //   action: 'httpsProxyTest',
    //   params: {}
    // });
  }, 2e3);

  useEffect(() => {
    (async () => {
      if (selectedServer && connected) {
        setLoading(true);

        await MessageChannel.invoke('main', 'service:main', {
          action: 'startClient',
          params: {
            config: config.find(i => i.id === selectedServer)!,
            settings
          }
        }).then(rsp => {
          if (rsp.code === 600 && rsp.result.isInUse) {
            MessageChannel.invoke('main', 'service:desktop', {
              action: 'openNotification',
              params: {
                title: t('warning'),
                body: t('the_local_port_is_occupied')
              }
            });
          }
        });

        setLoading(false);
      }
    })();
  }, [config, selectedServer, settings]);

  return (
    <Container className={styles.container}>

      {/* -------- menu ------- */}

      <Tabs
        value={mode} onChange={handleModeChange} centered
        indicatorColor="primary"
        textColor="primary"
      >
      {
        menuItems.map(value => (
          <Tab
            key={value}
            id={value}
            label={t(value.toLocaleLowerCase())}
            value={value}
          />
        ))
      }
      </Tabs>

      {/* -------- main ------- */}

      {config.length === 0 && (
        <div className={styles.empty}>
          <Typography variant="body1" color="textSecondary">
            No Server
          </Typography>
        </div>
      )}
      {
        !!config.length && (
          <List className={`${styles.list} ${styles.scrollbar}`}>
            {config.map((item, index) => (
              <ServerListItem
                key={item.id}
                remark={item.remark}
                ip={item.serverHost}
                port={item.serverPort}
                plugin={item.plugin}
                selected={item.id === selectedServer}
                onClick={() => handleServerSelect(item.id)}
                onShare={() => handleShareButtonClick(item.id)}
                onEdit={() => handleEditButtonClick(item.id)}
                onRemove={() => handleRemoveButtonClick(item.id)}
                isLast={index === config.length - 1}
              />
            ))}
          </List>
        )
      }
      <div className={styles.fabPlaceholder} />
      <div className={styles.fabs}>
        <Fab size="small" color="secondary" className={styles.noShadow} variant="round" onClick={handleDialogOpen}>
          <AddIcon />
        </Fab>
        <Fab
          size="small"
          variant="extended"
          disabled={loading}
          style={{
            backgroundColor: !connected ? yellow["800"] : green["A700"],
            color: 'white',
            paddingLeft: 14,
            paddingRight: 14
          }}
          onClick={handleServerConnect}
        >
          {loading ? (
            <CircularProgress
              className={styles.extendedIcon}
              color="inherit"
              size={20}
            />
          ) : (
            null // <Logo className={styles.extendedIcon} />
          )}
          {loading ? t("loading") : connected ? t("connected") : t("offline")}
        </Fab>
      </div>

      {/* -------- dialog ------- */}

      <AddServerDialog open={dialogOpen} onClose={handleDialogClose} children={undefined} />
      <ConfShareDialog
        dataUrl={shareData.dataUrl}
        url={shareData.url}
        open={shareDialogOpen}
        onClose={handleDialogClose}
        children={undefined}
      />
      <EditServerDialog
        open={editServerDialogOpen}
        defaultValues={
          editingServerId ? config.find(i => i.id === editingServerId)! : null
        }
        children={undefined}
        onClose={handleEditServerDialogClose}
        onValues={handleEditServer}
      />
      <DialogConfirm onClose={handleAlertDialogClose} onConfirm={handleServerRemove} />
      { SnackbarAlert }
      <BackDrop />

    </Container>
  );
};

export default HomePage;