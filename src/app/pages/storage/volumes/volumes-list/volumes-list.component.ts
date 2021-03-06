import { Component, ElementRef, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { RestService } from '../../../../services/';
import { debug } from 'util';
import { EntityUtils } from '../../../common/entity/utils';
import { EntityTableComponent, InputTableConf } from 'app/pages/common/entity/entity-table/entity-table.component';
import { DialogService } from 'app/services/dialog.service';
import { WebSocketService } from 'app/services/ws.service';
import { AppLoaderService } from 'app/services/app-loader/app-loader.service';
import { AfterViewInit } from '@angular/core/src/metadata/lifecycle_hooks';
import { DownloadKeyModalDialog } from 'app/components/common/dialog/downloadkey/downloadkey-dialog.component';
import { MatDialog } from '@angular/material';
import { TranslateService } from '@ngx-translate/core';
import * as _ from 'lodash';
import { MatSnackBar } from '@angular/material';
import * as moment from 'moment';

import { Injectable } from '@angular/core';
import { ErdService } from 'app/services/erd.service';
import { T } from '../../../../translate-marker';
import { EntityJobComponent } from '../../../common/entity/entity-job/entity-job.component';
import { StorageService } from '../../../../services/storage.service';
import { Validators } from '@angular/forms'
import { DialogFormConfiguration } from '../../../common/entity/entity-dialog/dialog-form-configuration.interface';
import { FieldConfig } from '../../../common/entity/entity-form/models/field-config.interface';


export interface ZfsPoolData {
  avail?: number;
  availStr?: string;
  id?: string;
  is_decrypted?: boolean;
  is_upgraded?: boolean;
  mountpoint?: string;
  name?: string;
  path?: string;
  nodePath?: string;
  parentPath?: string;
  status?: string;
  used?: number;
  used_pct?: string;
  usedStr?: string;
  sed_pct?: string;
  vol_encrypt?: number;
  vol_encryptkey?: string;
  vol_guid?: string;
  vol_name?: string;
  type?: string;
  compression?: string;
  dedup?: string;
  readonly?: string;
  children?: any[];
  dataset_data?: any;
  actions?: any[];
  comments?: string;
  compressionRatio?: any;
  volumesListTableConfig?: VolumesListTableConfig;

}


export class VolumesListTableConfig implements InputTableConf {
  public hideTopActions = true;
  public flattenedVolData: any;
  public resource_name = 'storage/volume';
  public rowData: ZfsPoolData[] = [];
  protected dialogRef: any;
  public route_add = ["storage", "pools", "import"];
  public route_add_tooltip = T("Create or Import Pool");
  public showDefaults: boolean = false;
  public showSpinner:boolean;
  public encryptedStatus: any;
  public custActions: Array<any> = [];



  constructor(
    private parentVolumesListComponent: VolumesListComponent,
    private _router: Router,
    private _classId: string,
    private title: string,
    private datasetData: Object,
    public mdDialog: MatDialog,
    protected rest: RestService,
    protected ws: WebSocketService,
    protected dialogService: DialogService,
    protected loader: AppLoaderService,
    protected translate: TranslateService,
    protected snackBar: MatSnackBar
  ) {

    if (typeof (this._classId) !== "undefined" && this._classId !== "") {
      this.resource_name += "/" + this._classId;

      this.rest.get(this.resource_name, {}).subscribe((res) => {
        this.rowData = [];

        this.rowData = this.resourceTransformIncomingRestData(res.data);
      }, (res) => {
        this.dialogService.errorReport(T("Error getting pool or dataset data."), res.message, res.stack);
      });
    }
  }

  isCustActionVisible(actionname: string) {
    if (actionname === 'download_key' && this.encryptedStatus !== '') {
      return true;
    } else {
      return false;
    }
  }

  getEncryptedActions(rowData: any) {
    const actions = [];

    if (rowData.vol_encrypt === 2) {

      if (rowData.is_decrypted) {
        actions.push({
          label: T("Lock"),
          onClick: (row1) => {
            this.dialogService.confirm(T("Lock Pool"), T("Lock ") + row1.name + "?").subscribe((confirmResult) => {
              if (confirmResult === true) {
                this.loader.open();
                this.rest.post(this.resource_name + "/" + row1.name + "/lock/", { body: JSON.stringify({}) }).subscribe((restPostResp) => {
                  this.loader.close();
                  this.parentVolumesListComponent.repaintMe();

                }, (res) => {
                  this.loader.close();
                  this.dialogService.errorReport(T("Error locking pool."), res.message, res.stack);
                });
              }
            });
          }
        });

      } else {
        actions.push({
          label: T("Unlock"),
          onClick: (row1) => {
            this.unlockAction(row1);
          }
        });
      }

      if (rowData.is_decrypted) {
        actions.push({
          label: T("Change Passphrase"),
          onClick: (row1) => {
            this._router.navigate(new Array('/').concat(
              ["storage", "pools", "changekey", row1.id]));
          }
        });
      }

    } else if (rowData.vol_encrypt === 1 && rowData.is_decrypted) {
      actions.push({
        label: T("Create Passphrase"),
        onClick: (row1) => {
          this._router.navigate(new Array('/').concat(
            ["storage", "pools", "createkey", row1.id]));
        }
      });
    }

    if (rowData.is_decrypted) {

      actions.push({
        label: T("Add Recovery Key"),
        onClick: (row1) => {
          this._router.navigate(new Array('/').concat(
            ["storage", "pools", "addkey", row1.id]));
        }
      });

      actions.push({
        label: T("Delete Recovery Key"),
        onClick: (row1) => {
          this.dialogService.confirm(T("Delete Recovery Key"), T("Delete recovery key for ") + row1.name + "?").subscribe((confirmResult) => {
            if (confirmResult === true) {
              this.loader.open();

              this.rest.delete(this.resource_name + "/" + row1.name + "/recoverykey/", { body: JSON.stringify({}) }).subscribe((restPostResp) => {
                this.loader.close();

                this.dialogService.Info(T("Deleted Recovery Key"), T("Successfully deleted recovery key for ") + row1.name).subscribe((infoResult) => {
                  this.parentVolumesListComponent.repaintMe();
                });
              }, (res) => {
                this.loader.close();
                this.dialogService.errorReport(T("Error Deleting Key"), res.message, res.stack);
              });
            }
          });
        }
      });

      actions.push({
        label: T("Encryption Rekey"),
        onClick: (row1) => {
          this._router.navigate(new Array('/').concat(
            ["storage", "pools", "rekey", row1.id]));

        }
      });

      actions.push({
        label: T("Download Encrypt Key"),
        onClick: (row1) => {
          const dialogRef = this.mdDialog.open(DownloadKeyModalDialog, { disableClose: true });
          dialogRef.componentInstance.volumeId = row1.id;

        }
      });
    }

    return actions;
  }

  unlockAction(row1) {
    let localLoader = this.loader,
    localRest = this.rest,
    localParentVol = this.parentVolumesListComponent,
    localDialogService = this.dialogService,
    localSnackBar = this.snackBar;

    const conf: DialogFormConfiguration = {
      title: "Unlock " + row1.name,
      fieldConfig: [{
        type : 'input',
        inputType: 'password',
        name : 'passphrase',
        togglePw: true,
        placeholder: T('Passphrase'),
      },
      {
        type: 'input',
        name: 'recovery_key',
        placeholder: T('Recovery Key'),
        tooltip: T('Click <b>Browse</b> to select a recovery key to\
                    upload. This allows the system to decrypt the\
                    disks.'),
        inputType: 'file',
        fileType: 'binary'
      },
      {
        type: 'select',
        name: 'services',
        placeholder: T('Restart Services'),
        tooltip: T('List of system services to restart when the pool is\
                    unlocked.'),
        multiple: true,
        value: ['afp','cifs','ftp','iscsitarget','nfs','webdav','jails'],
        options: [{label: 'AFP', value: 'afp'},
                 {label: 'SMB', value: 'cifs'},
                 {label: 'FTP', value: 'ftp'},
                 {label: 'iSCSI', value: 'iscsitarget'},
                 {label: 'NFS', value: 'nfs'},
                 {label: 'WebDAV', value: 'webdav'},
                 {label: 'Jails/Plugins', value: 'jails'}]
      }
      ],

      saveButtonText: T("Unlock"),
      customSubmit: function (entityDialog) {
        const value = entityDialog.formValue;
        localLoader.open();
        return localRest.post("storage/volume/" + row1.name + "/unlock/",
          { body: JSON.stringify({
             passphrase: value.passphrase,
             recovery_key: value.recovery_key,
             services: value.services
            }) 
          }).subscribe((restPostResp) => {
          entityDialog.dialogRef.close(true);
          localLoader.close();
          localParentVol.repaintMe();
          localSnackBar.open(row1.name + " has been unlocked.", 'close', { duration: 5000 });
        }, (res) => {
          localLoader.close();
          localDialogService.errorReport(T("Error Unlocking"), res.error, res.stack);
        });
      }
    }
    this.dialogService.dialogForm(conf);
  }

  getPoolData(poolId: number) {
    return this.ws.call('pool.query', [
      [
        ["id", "=", poolId]
      ]
    ]);
  }

  getActions(rowData: any) {
    let rowDataPathSplit = [];
    if (rowData.path) {
      rowDataPathSplit = rowData.path.split('/');
    }
    const actions = [];
    //workaround to make deleting volumes work again,  was if (row.vol_fstype == "ZFS")
    if (rowData.type === 'zpool') {

      actions.push({
        label: T("Detach"),
        onClick: (row1) => {

          let encryptedStatus = row1.vol_encryptkey,
            localLoader = this.loader,
            localRest = this.rest,
            localParentVol = this.parentVolumesListComponent,
            localDialogService = this.dialogService

          const conf: DialogFormConfiguration = { 
            title: "Detach pool: '" + row1.name + "'",
            fieldConfig: [{
              type: 'paragraph',
              name: 'pool_detach_warning',
              paraText: T("WARNING: Detaching '" + row1.name + "'. \
                           Detaching a pool makes the data unavailable. \
                           The pool data can also be wiped by setting the\
                           related option. Back up any critical data \
                           before detaching a pool."),
              isHidden: false
            }, {
              type: 'paragraph',
              name: 'pool_detach_warning',
              paraText: T("'" + row1.name + "' is encrypted! If the passphrase for \
                           this encrypted pool has been lost, the data will be PERMANENTLY UNRECOVERABLE! \
                           Before detaching encrypted pools, download and safely\
                           store the recovery key."),
              isHidden: encryptedStatus !== '' ? false : true
            }, {
              type: 'checkbox',
              name: 'destroy',
              value: false,
              placeholder: T("Destroy data on this pool?"),
            }, {
              type: 'checkbox',
              name: 'cascade',
              value: true,
              placeholder: T("Delete configuration of shares that used this pool?"),
            }, {
              type: 'checkbox',
              name: 'confirm',
              placeholder: T("Confirm detach"),
              required: true
            }],
            isCustActionVisible(actionId: string) {
              if (actionId == 'download_key' && encryptedStatus === '') {
                return false;
              } else {
                return true;
              }
            },
            saveButtonText: T('Detach'),
            custActions: [
              {
                id: 'download_key',
                name: 'Download Key',
                function: () => {
                  const dialogRef = this.mdDialog.open(DownloadKeyModalDialog, { disableClose: true });
                  dialogRef.componentInstance.volumeId = row1.id;
                }
              }],
            customSubmit: function (entityDialog) {
              const value = entityDialog.formValue;
              localLoader.open();
              if (value.destroy === false) { 
                return localRest.delete("storage/volume/" + row1.name, { body: JSON.stringify({ destroy: value.destroy, cascade: value.cascade }) 
                  }).subscribe((res) => {
                    entityDialog.dialogRef.close(true);
                    localLoader.close();
                    localDialogService.Info(T("Detach Pool"), T("Successfully detached '") + row1.name + "'");
                    localParentVol.repaintMe();
                }, (res) => {
                  localLoader.close();
                  localDialogService.errorReport(T("Error detaching pool."), res.message, res.stack);
                });
              } else {
                return localRest.delete("storage/volume/" + row1.name, { body: JSON.stringify({}) 
                  }).subscribe((res) => {
                    entityDialog.dialogRef.close(true);
                    localLoader.close();
                    localDialogService.Info(T("Detach Pool"), T("Successfully detached '") + row1.name + 
                      T("'. All data on that pool was destroyed."));
                    localParentVol.repaintMe();
                }, (res) => {
                  localLoader.close();
                  localDialogService.errorReport(T("Error detaching pool."), res.message, res.stack);
                });
              }
            }
            
          }
          this.dialogService.dialogForm(conf);
        }
      });

      if (rowData.is_decrypted) {
        actions.push({
          label: T("Extend"),
          onClick: (row1) => {
            this._router.navigate(new Array('/').concat(
              ["storage", "pools", "manager", row1.id]));
          }
        });
        actions.push({
          label: T("Scrub Pool"),
          onClick: (row1) => {
            this.getPoolData(row1.id).subscribe((res) => {
              if (res[0]) {
                if (res[0].scan.function === "SCRUB" && res[0].scan.state === "SCANNING") {
                  const message = "Stop the scrub on " + row1.name + "?";
                  this.dialogService.confirm("Scrub Pool", message, false, T("Stop Scrub")).subscribe((res) => {
                    if (res) {
                      this.loader.open();
                      this.rest.delete("storage/volume/" + row1.id + "/scrub/", { body: JSON.stringify({}) }).subscribe(
                        (res) => {
                          this.loader.close();
                          this.snackBar.open(res.data, 'close', { duration: 5000 });
                        },
                        (res) => {
                          this.loader.close();
                          new EntityUtils().handleError(this, res);
                        });
                    }
                  });
                } else {
                  const message = "Start a scrub on " + row1.name + "?";
                  this.dialogService.confirm("Scrub Pool", message, false, T("Start Scrub")).subscribe((res) => {
                    if (res) {
                      this.loader.open();
                      this.rest.post("storage/volume/" + row1.id + "/scrub/", { body: JSON.stringify({}) }).subscribe(
                        (res) => {
                          this.loader.close();
                          this.snackBar.open(res.data, 'close', { duration: 5000 });
                        },
                        (res) => {
                          this.loader.close();
                          new EntityUtils().handleError(this, res);
                        });
                    }
                  });
                }
              }
            })
          }
        });
        actions.push({
          label: T("Status"),
          onClick: (row1) => {
            this._router.navigate(new Array('/').concat(
              ["storage", "pools", "status", row1.id]));
          }
        });

        if (rowData.is_upgraded === false) {

          actions.push({
            label: T("Upgrade Pool"),
            onClick: (row1) => {

              this.dialogService.confirm(T("Upgrade Pool"), T("Proceed with upgrading the pool? WARNING: Upgrading a pool is a\
                                                              one-way operation that might make some features of \
                                                              the pool incompatible with older versions of FreeNAS: ") + row1.name).subscribe((confirmResult) => {
                  if (confirmResult === true) {
                    this.loader.open();

                    this.rest.post("storage/volume/" + row1.id + "/upgrade", { body: JSON.stringify({}) }).subscribe((restPostResp) => {
                      this.loader.close();

                      this.dialogService.Info(T("Upgraded"), T("Successfully Upgraded ") + row1.name).subscribe((infoResult) => {
                        this.parentVolumesListComponent.repaintMe();
                      });
                    }, (res) => {
                      this.loader.close();
                      this.dialogService.errorReport(T("Error Upgrading Pool ") + row1.name, res.message, res.stack);
                    });
                  }
                });

            }
          });
        }
      }
    }

    if (rowData.type === "dataset") {
      actions.push({
        label: T("Add Dataset"),
        onClick: (row1) => {
          this._router.navigate(new Array('/').concat([
            "storage", "pools", "id", row1.path.split('/')[0], "dataset",
            "add", row1.path
          ]));
        }
      });
      actions.push({
        label: T("Add Zvol"),
        onClick: (row1) => {
          this._router.navigate(new Array('/').concat([
            "storage", "pools", "id", row1.path.split('/')[0], "zvol", "add",
            row1.path
          ]));
        }
      });
      actions.push({
        label: T("Edit Options"),
        onClick: (row1) => {
          this._router.navigate(new Array('/').concat([
            "storage", "pools", "id", row1.path.split('/')[0], "dataset",
            "edit", row1.path
          ]));
        }
      });
      if (rowDataPathSplit[1] !== "iocage") {
        actions.push({
          label: T("Edit Permissions"),
          onClick: (row1) => {
            this._router.navigate(new Array('/').concat([
              "storage", "pools", "id", row1.path.split('/')[0], "dataset",
              "permissions", row1.path
            ]));
          }
        });
      }

      if (rowData.path.indexOf('/') !== -1) {
        actions.push({
          label: T("Delete Dataset"),
          onClick: (row1) => {

            this.dialogService.confirm(T("Delete"), T("This action is irreversible and will \
             delete any existing snapshots of this dataset (" + row1.path + ").  Please confirm."), false, T('Delete Dataset')).subscribe((res) => {
                if (res) {

                  this.loader.open();

                  const url = "storage/dataset/" + row1.path;


                  this.rest.delete(url, {}).subscribe((res) => {
                    this.loader.close();
                    this.parentVolumesListComponent.repaintMe();
                  }, (error) => {
                    this.loader.close();
                    this.dialogService.errorReport(T("Error deleting dataset."), error.message, error.stack);
                  });

                }
              });
          }
        });

      }

      let rowDataset = _.find(this.datasetData, { id: rowData.path });
      if (rowDataset && rowDataset['origin'] && !!rowDataset['origin'].parsed) {
        actions.push({
          label: T("Promote Dataset"),
          onClick: (row1) => {
            this.loader.open();

            this.ws.call('pool.dataset.promote', [row1.path]).subscribe((wsResp) => {
              this.loader.close();
              // Showing info here because there is no feedback on list parent for this if promoted.
              this.dialogService.Info(T("Promote Dataset"), T("Successfully Promoted ") + row1.path).subscribe((infoResult) => {
                this.parentVolumesListComponent.repaintMe();
              });
            }, (res) => {
              this.loader.close();
              this.dialogService.errorReport(T("Error Promoting dataset ") + row1.path, res.reason, res.stack);
            });
          }
        });
      }
    }
    if (rowData.type === "zvol") {
      actions.push({
        label: T("Delete zvol"),
        onClick: (row1) => {
          this.dialogService.confirm(T("Delete zvol:" + row1.path), T("Please confirm the deletion of zvol:" + row1.path), false, T('Delete Zvol')).subscribe((confirmed) => {
            if (confirmed === true) {
              this.loader.open();

              this.ws.call('pool.dataset.delete', [row1.path]).subscribe((wsResp) => {
                this.loader.close();
                this.parentVolumesListComponent.repaintMe();

              }, (res) => {
                this.loader.close();
                this.dialogService.errorReport(T("Error Deleting zvol ") + row1.path, res.reason, res.stack);
              });
            }
          });


        }
      });
      actions.push({
        label: T("Edit Zvol"),
        onClick: (row1) => {
          this._router.navigate(new Array('/').concat([
            "storage", "pools", "id", row1.path.split('/')[0], "zvol", "edit",
            row1.path
          ]));
        }
      });


    }
    if (rowData.type === "zvol" || rowData.type === "dataset") {
      actions.push({
        label: T("Create Snapshot"),
        onClick: (row) => {
          const conf: DialogFormConfiguration = {
            title: "One time snapshot of " + row.path,
            fieldConfig: [
              {
                type: 'input',
                name: 'dataset',
                placeholder: T('Pool/Dataset'),
                value: row.path,
                isHidden: true,
                readonly: true
              },
              {
                type: 'input',
                name: 'name',
                placeholder: T('Name'),
                tooltip: T('Add a name for the new snapshot.'),
                validation: [Validators.required],
                required: true,
                value: "manual" + '-' + this.getTimestamp()            },
              {
                type: 'checkbox',
                name: 'recursive',
                placeholder: T('Recursive'),
                tooltip: T('Set to include child datasets of the chosen dataset.'),
              }
            ],
            method_rest: "storage/snapshot",
            saveButtonText: T("Create Snapshot"),
          }
          this.ws.call('vmware.query',[[["filesystem", "=", row.path]]]).subscribe((vmware_res)=>{
            if(vmware_res.length !== 0){
              const vmware_cb = {
                type: 'checkbox',
                name: 'vmware_sync',
                placeholder: T('VMWare Sync'),
                tooltip: T(''),
              }
              conf.fieldConfig.push(vmware_cb);
            }
            this.dialogService.dialogForm(conf).subscribe((res) => {
              if (res) {
                this.snackBar.open(T("Snapshot successfully taken."), T('close'), { duration: 5000 });
              }
            });
          })
        }
      });
    }
    return actions;
  }

  getTimestamp() {
    let dateTime = new Date();
    return moment(dateTime).format("YYYYMMDD");
  }

  resourceTransformIncomingRestData(data: any): ZfsPoolData[] {

    data = new EntityUtils().flattenData(data);
    const dataset_data2 = this.datasetData;
    const returnData: ZfsPoolData[] = [];
    const numberIdPathMap: Map<string, number> = new Map<string, number>();

    for (let i in data) {

      const dataObj = data[i];

      dataObj.nodePath = dataObj.mountpoint;

      if (typeof (dataObj.nodePath) === "undefined" && typeof (dataObj.path) !== "undefined") {
        dataObj.nodePath = "/mnt/" + dataObj.path;
      }

      dataObj.parentPath = dataObj.nodePath.slice(0, dataObj.nodePath.lastIndexOf("/"));

      if (dataObj.status !== '-') {
        // THEN THIS A ZFS_POOL DON'T ADD    dataObj.type = 'zpool'
        continue;
      } else if (typeof (dataObj.nodePath) === "undefined" || dataObj.nodePath.indexOf("/") === -1) {
        continue;
      }

      if ("/mnt" === dataObj.parentPath) {
        dataObj.parentPath = "0";
      }

      try {
        dataObj.availStr = (<any>window).filesize(dataObj.avail, { standard: "iec" });
      } catch (error) {
        dataObj.availStr = "" + dataObj.avail;
      }

      try {
        dataObj.usedStr = (<any>window).filesize(dataObj.used, { standard: "iec" });
      } catch (error) {
        dataObj.usedStr = "" + dataObj.used;
      }

      dataObj.compression = "";
      dataObj.readonly = "";
      dataObj.dedup = "";
      dataObj.comments = "";
      dataObj.compressratio = "";

      for (let k in dataset_data2) {

        if (dataset_data2[k].mountpoint === dataObj.nodePath) {

          if (dataset_data2[k].compression) {
            dataset_data2[k].compression.source !== "INHERITED"
              ? dataObj.compression = (dataset_data2[k].compression.parsed)
              : dataObj.compression = ("Inherits (" + dataset_data2[k].compression.parsed + ")");
          }

          if (dataset_data2[k].compressratio) {
            dataset_data2[k].compressratio.source !== "INHERITED"
              ? dataObj.compressratio = (dataset_data2[k].compressratio.parsed)
              : dataObj.compressratio = ("Inherits (" + dataset_data2[k].compressratio.parsed + ")");
          }

          if (dataset_data2[k].readonly) {
            dataset_data2[k].readonly.source !== "INHERITED"
              ? dataObj.readonly = (dataset_data2[k].readonly.parsed)
              : dataObj.readonly = ("Inherits (" + dataset_data2[k].readonly.parsed + ")");
          }

          if (dataset_data2[k].deduplication) {
            dataset_data2[k].deduplication.source !== "INHERITED"
              ? dataObj.dedup = (dataset_data2[k].deduplication.parsed)
              : dataObj.dedup = ("Inherits (" + dataset_data2[k].deduplication.parsed + ")");
          }

          if (dataset_data2[k].comments) {
            dataset_data2[k].comments.source !== "INHERITED"
              ? dataObj.comments = (dataset_data2[k].comments.parsed)
              : dataObj.comments = ("");
          }
        }

      }

      dataObj.actions = this.getActions(dataObj);

      returnData.push(dataObj);
    }

    return returnData;
  };


}


@Component({
  selector: 'app-volumes-list',
  styleUrls: ['./volumes-list.component.css'],
  templateUrl: './volumes-list.component.html'
})
export class VolumesListComponent extends EntityTableComponent implements OnInit, AfterViewInit {

  title = T("Pools");
  zfsPoolRows: ZfsPoolData[] = [];
  conf: InputTableConf = new VolumesListTableConfig(this, this.router, "", "Pools", {}, this.mdDialog, this.rest, this.ws, this.dialogService, this.loader, this.translate, this.snackBar);

  actionComponent = {
    getActions: (row) => {
      return this.conf.getActions(row);
    },
    conf: new VolumesListTableConfig(this, this.router, "", "Pools", {}, this.mdDialog, this.rest, this.ws, this.dialogService, this.loader, this.translate, this.snackBar)
  };

  actionEncryptedComponent = {
    getActions: (row) => {
      return (<VolumesListTableConfig>this.conf).getEncryptedActions(row);
    },
    conf: new VolumesListTableConfig(this, this.router, "", "Pools", {}, this.mdDialog, this.rest, this.ws, this.dialogService, this.loader, this.translate, this.snackBar)
  };

  expanded = false;
  public paintMe = true;


  constructor(protected rest: RestService, protected router: Router, protected ws: WebSocketService,
    protected _eRef: ElementRef, protected dialogService: DialogService, protected loader: AppLoaderService,
    protected mdDialog: MatDialog, protected erdService: ErdService, protected translate: TranslateService,
    public sorter: StorageService, protected snackBar: MatSnackBar) {
    super(rest, router, ws, _eRef, dialogService, loader, erdService, translate, snackBar, sorter);
  }

  public repaintMe() {
    this.showDefaults = false;
    this.paintMe = false;
    this.ngOnInit();
  }

  ngOnInit(): void {
    this.showSpinner = true;

    while (this.zfsPoolRows.length > 0) {
      this.zfsPoolRows.pop();
    }

    this.ws.call('pool.dataset.query', []).subscribe((datasetData) => {
      this.rest.get("storage/volume", {}).subscribe((res) => {
        res.data.forEach((volume: ZfsPoolData) => {
          volume.volumesListTableConfig = new VolumesListTableConfig(this, this.router, volume.id, volume.name, datasetData, this.mdDialog, this.rest, this.ws, this.dialogService, this.loader, this.translate, this.snackBar);
          volume.type = 'zpool';

          try {
            volume.availStr = (<any>window).filesize(volume.avail, { standard: "iec" });
          } catch (error) {
            volume.availStr = "" + volume.avail;
          }

          try {
            volume.usedStr = (<any>window).filesize(volume.used, { standard: "iec" }) + " (" + volume.used_pct + ")";
          } catch (error) {
            volume.usedStr = "" + volume.used;
          }
          this.zfsPoolRows.push(volume);
        });

        this.zfsPoolRows = this.sorter.tableSorter(this.zfsPoolRows, 'name', 'asc');

        if (this.zfsPoolRows.length === 1) {
          this.expanded = true;
        }

        this.paintMe = true;

        this.showDefaults = true;
        this.showSpinner = false;

        
      }, (res) => {
        this.showDefaults = true;
        this.showSpinner = false;

        this.dialogService.errorReport(T("Error getting pool data."), res.message, res.stack);
      });
    }, (res) => {
      this.showDefaults = true;
      this.showSpinner = false;

      this.dialogService.errorReport(T("Error getting pool data."), res.message, res.stack);
    });

  }

  ngAfterViewInit(): void {

  }

}
