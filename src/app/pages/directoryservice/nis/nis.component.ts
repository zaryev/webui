import {ApplicationRef, Component, Injector, OnInit} from '@angular/core';
import {ActivatedRoute, Router, RouterModule} from '@angular/router';
import * as _ from 'lodash';
import {Subscription} from 'rxjs/Subscription';
import {  DialogService } from '../../../services/';
import { Validators } from '@angular/forms';

import { T } from '../../../translate-marker';

import {
  RestService,
  SystemGeneralService,
  WebSocketService
} from '../../../services/';
import {
  FieldConfig
} from '../../common/entity/entity-form/models/field-config.interface';

@Component({
  selector : 'app-nis',
  template : `<entity-form [conf]="this"></entity-form>`,
})

export class NISComponent {
  protected resource_name =  'directoryservice/nis/';
  public custActions: Array<any> = [
    {
      'id' : 'ds_clearcache',
      'name' : T('Rebuild Directory Service Cache'),
       function : async () => {
         this.ws.call('notifier.ds_clearcache').subscribe((cache_status)=>{
          this.dialogservice.Info("NIS", "The cache is being rebuilt.");

        })
      }
    }
  ];

  public fieldConfig: FieldConfig[] = [
    {
      type : 'input',
      name : 'nis_domain',
      placeholder : T('NIS domain'),
      tooltip: T('Name of NIS domain.'),
      required: true,
      validation : [ Validators.required ]
    },
    {
      type : 'input',
      name : 'nis_servers',
      placeholder : T('NIS servers'),
      tooltip : T('Enter a comma-delimited list of hostnames or IP\
                   addresses.')
    },
    {
      type : 'checkbox',
      name : 'nis_secure_mode',
      placeholder : T('Secure mode'),
      tooltip : T('Set to have <a\
                   href="https://www.freebsd.org/cgi/man.cgi?query=ypbind"\
                   target="_blank">ypbind(8)</a> refuse to bind to any NIS\
                   server not running as root on a TCP port over 1024.')
    },
    {
      type : 'checkbox',
      name : 'nis_manycast',
      placeholder : T('Manycast'),
      tooltip : T('Set for ypbind to bind to the server that responds\
                   the fastest.')
    },
    {
      type : 'checkbox',
      name : 'nis_enable',
      placeholder : T('Enable'),
      tooltip : T('Unset to disable the configuration without deleting it.')
    },
  ];

  constructor(protected router: Router, protected route: ActivatedRoute,
              protected rest: RestService, protected ws: WebSocketService,
              protected _injector: Injector, protected _appRef: ApplicationRef,
              protected systemGeneralService: SystemGeneralService,
              private dialogservice: DialogService) {}
}
