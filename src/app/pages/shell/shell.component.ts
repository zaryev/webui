import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ViewChildren,
  ElementRef,
  OnChanges,
  Input,
  Output,
  EventEmitter,
  SimpleChange,
  OnDestroy
} from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import { CoreService, CoreEvent } from 'app/core/services/core.service';
import { iXObject } from 'app/core/classes/ix-object';
import { DisplayObject } from 'app/core/classes/display-object';
import * as Terminal from 'xterm/dist/xterm';
import 'xterm/dist/addons/fit/fit.js';
import 'xterm/dist/addons/attach/attach.js';



import { WebSocketService, ShellService } from '../../services/';
import { TranslateService } from '@ngx-translate/core';
import {TooltipComponent} from '../common/entity/entity-form/components/tooltip/tooltip.component';
import { T } from '../../translate-marker';
//import { Terminal } from 'vscode-xterm';
//import * as fit from 'vscode-xterm/lib/addons/fit';
//import * as attach from 'vscode-xterm/lib/addons/attach';

@Component({
  selector: 'app-shell',
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.css'],
  providers: [ShellService],
})

export class ShellComponent extends iXObject implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  // sets the shell prompt
  @Input() prompt = '';
  //xterm container
  //@ViewChildren('terminal') container: ElementRef;
  @ViewChild('terminal') container: ElementRef;
  private containerElement: DisplayObject;
  // xterm variables
  cols: string;
  rows: string;
  font_size: number;
  // Help determine xterm resize parameters
  private colW: number;
  private rowH: number;
  public token: any;
  public xterm: any;
  private isResizing:boolean = false;
  public resize_terminal = true;
  private shellSubscription: any;

  public shell_tooltip = T('<b>Ctrl+C</b> kills a foreground process.<br>\
                            Many utilities are built-in:<br> <b>Iperf</b>,\
                            <b>Netperf</b>, <b>IOzone</b>, <b>arcsat</b>,\
                            <b>tw_cli</b>, <br><b>MegaCli</b>,\
                            <b>freenas-debug</b>, <b>tmux</b>,\
                            <b>Dmidecode</b>.<br> Refer to the <a\
                            href="..//docs/cli.html"\
                            target="_blank">Command Line Utilities</a>\
                            chapter in the guide for usage information\
                            and examples.');

  clearLine = "\u001b[2K\r"
  public shellConnected: boolean = false;

  ngOnInit() {
  }

  ngAfterViewInit(){
    this.resetDefault();


    this.core.register({observerClass:this, eventName:this.id}).subscribe((evt:CoreEvent) => {
      this.containerElement = evt.data;
      this.containerElement.element.set('height', 400);
      this.prepareTerminalConnection();
    })

    this.core.register({observerClass:this, eventName:"ResizeStarted" + this.id}).subscribe((evt:CoreEvent) => {
      this.isResizing = true;
    });

    this.core.register({observerClass:this, eventName:"ResizeStopped" + this.id}).subscribe((evt:CoreEvent) => {
      console.log("Shell heard the release...");
      this.isResizing = false;
      //this.resizeTerminal();
      this.xterm.fit();
    })

    this.core.emit({name:"RegisterAsDisplayObject", data:{ id:"#" + this.id , moveHandle: "#" + this.id + " .drag-handle"} });
    this.core.emit({name:"RequestDisplayObjectReference", data:this.id});
  }

  ngOnDestroy() {
    if (this.ss.connected){
      this.ss.socket.close();
    }
    if(this.shellSubscription){
      this.shellSubscription.unsubscribe();
    }

    this.core.unregister({observerClass:this});
  };

  onResize(event){
    // this.resizeTerm();
  }

  resetDefault() {
    this.font_size = 14;
  }

  ngOnChanges(changes: {
    [propKey: string]: SimpleChange
  }) {
    const log: string[] = [];
    for (const propName in changes) {
      const changedProp = changes[propName];
      // reprint prompt
      if (propName === 'prompt' && this.xterm != null) {
        this.xterm.write(this.clearLine + this.prompt)
      }
    }
  }

  prepareTerminalConnection(){
    this.getAuthToken().subscribe((res) => {
      this.initializeWebShell(res);
      this.shellSubscription = this.ss.shellOutput.subscribe((value) => {
        if (value !== undefined) {
          this.xterm.write(value);
        }
      });

    /*this.container.changes.subscribe((comps: QueryList<MyComponent>) => {
      // Now you can access to the child component
      this.initializeTerminal();
    });*/
      console.log("prep")
      this.initializeTerminal();
    });
  }

  initializeTerminal() {
    /*const domHeight = document.body.offsetHeight;
    const domWidth = document.body.offsetWidth;
    let colNum = (domWidth * 0.75 - 104) / 10;
    if (colNum < 80) {
      colNum = 80;
    }
    let rowNum = (domHeight * 0.75 - 104) / 21;
    if (rowNum < 10) {
      rowNum = 10;
    }*/

    this.xterm = new Terminal();
    console.log("init");
    
    this.xterm.open(this.container.nativeElement);
    console.log(this.container.nativeElement)
    //this.xterm.open(this.container.first.nativeElement);
    //this.xterm.open(this.containerElement.rawElement);
    this.xterm.attach(this.ss); 
    this.xterm._initialized = true;
    this.xterm.focus();
    this.xterm.fit();
    
    return this.xterm;
  }

  resizeTerminal(getUnits?: boolean){
    if(getUnits){
      this.colW = this.calcColWidth();
      this.rowH = this.calcRowHeight();
    }
    console.log("resizing terminal...")
    console.log(this.colW);
    console.log(this.rowH);
    console.log("Width = " + this.containerElement.width + " && Height = " + (this.containerElement.height - 48))
    console.log("CURRENTLY: Cols = " + this.xterm.cols + " && Rows = " + this.xterm.rows);
    console.log(this.font_size)
    const cols = this.containerElement.width / this.colW;
    const rows = (this.containerElement.height - 48) / this.rowH; // Subtract mat-toolbar height
    console.log("RESIZING TO: Cols = " + cols + " && Rows = " + rows);
    this.xterm.geometry = [cols, rows]
    this.xterm.resize( 75, rows);
    this.xterm.reset();
    console.log(this.containerElement.height);

  }

  calcRowHeight(){
    return Math.ceil(this.containerElement.height / this.xterm.rows);
  }

  calcColWidth(){
    return Math.ceil(this.containerElement.width / this.xterm.cols)
  }

  resizeTerm(){
    const domHeight = document.body.offsetHeight;
    const domWidth = document.body.offsetWidth;
    let colNum = (domWidth * 0.75 - 104) / 10;
    if (colNum < 80) {
      colNum = 80;
    }
    let rowNum = (domHeight * 0.75 - 104) / 21;
    if (rowNum < 10) {
      rowNum = 10;
    }
    this.xterm.resize(colNum,rowNum);
    return true;
  }

  initializeWebShell(res: string) {
    this.ss.token = res;
    this.ss.connect();

    this.ss.shellConnected.subscribe((res)=> {
      this.shellConnected = res;
    })
  }

  getAuthToken() {
    return this.ws.call('auth.generate_token');
  }

  reconnect() {
    this.ss.connect();
  }

  constructor(private core:CoreService, private ws: WebSocketService, public ss: ShellService, public translate: TranslateService, elRef: ElementRef) {
    super();
//    Terminal.applyAddon(fit);
//    Terminal.applyAddon(attach);
  }
}
