// =============================================================================
// CONFIGURAZIONE E INIT
// =============================================================================

const CONFIG = {
  COLORS: [
    {name:'Rosso',hex:'#e74c3c'},{name:'Arancione',hex:'#e67e22'},{name:'Giallo',hex:'#f1c40f'},{name:'Verde Chiaro',hex:'#a3e4d7'},{name:'Verde',hex:'#2ecc71'},
    {name:'Turchese',hex:'#1abc9c'},{name:'Celeste',hex:'#3498db'},{name:'Blu',hex:'#246eb9'},{name:'Viola',hex:'#9b59b6'},{name:'Lavanda',hex:'#d7bde2'},
    {name:'Magenta',hex:'#ff00ff'},{name:'Rosa',hex:'#e84393'},{name:'Beige',hex:'#f5f5dc'},{name:'Oro',hex:'#f39c12'},{name:'Marrone',hex:'#795548'},
    {name:'Verde Oliva',hex:'#556b2f'},{name:'Bianco',hex:'#ffffff'},{name:'Grigio Chiaro',hex:'#bdc3c7'},{name:'Grigio',hex:'#95a5a6'},{name:'Nero',hex:'#000000'}
  ],
  initialCellSize: 50,
  maxCellSize: 200, 
  minCellSize: 10
};

class FixGrid {
  constructor(){
    this.grid = document.getElementById('main-grid');
    this.gridContainer = document.getElementById('grid-container-ref');
    this.palette = document.getElementById('palette');
    this.toolButtons = document.querySelectorAll('.tool-button'); 
    this.strokeWidthButtons = document.querySelectorAll('#stroke-width-buttons button'); 
    this.dynamicTooltip = document.getElementById('dynamic-measure-tooltip');
    
    this.arcStatusSpan = document.getElementById('arc-status');
    this.toggleGridSnapCheckbox = document.getElementById('toggle-grid-snap');
    this.toggleObjectSnapCheckbox = document.getElementById('toggle-object-snap');
    this.eraseSelectedBtn = document.getElementById('erase-selected'); 
    this.toggleDashedCheckbox = document.getElementById('toggle-dashed');
    this.toggleCounterClockwiseCheckbox = document.getElementById('toggle-counterclockwise');
    
    this.toggleArrowStart = document.getElementById('toggle-arrow-start');
    this.toggleArrowEnd = document.getElementById('toggle-arrow-end');
    
    this.toggleSubGridCheckbox = document.getElementById('toggle-subgrid');
    this.isSubGridVisible = false;

    this.toggleIsoBtn = document.getElementById('toggle-iso');
    this.toggleCartesianBtn = document.getElementById('toggle-cartesian');

    this.gridBgCanvas = document.getElementById('grid-bg');
    this.gridBgCtx = null;

    // state
    this.tool = 'line'; 
    this.selectedColor = CONFIG.COLORS[19];
    this.customColorHex = '#ffffff'; 
    this.strokeWidth = 3; 
    this.isDashed = false;
    this.isCounterClockwise = false; 
    this.isBold = true; 
    this.isArrowStart = false; 
    this.isArrowEnd = false; 
    this.isGridVisible = true; 
    this.cellSizeCSS = CONFIG.initialCellSize; 
    
    // States griglia
    this.isIsometric = false; 
    this.isCartesian = false;

    this.gridSize = 16;
    this.cols = 16; 
    this.rows = 16;
    this.toolProps = {}; 
    this.shapes = []; 
    this.selectedShapes = []; 
    this.redoShapes = []; 
    this.currentPolygonPoints = [];
    this.isDrawingLine = false;
    this.lineStart = null;
    
    // Supporto Tutorial (Ghost Mode)
    this.isRecording = false;
    this.tutorialLog = []; 
    this.ghostShapes = [];
    this.isGhostMode = false;
    this.currentTutorialIndex = -1;
    this.playInterval = null;
    this._preDemoShapes = null; // backup del disegno reale prima di "Ricomincia da zero" (⏪)

    // Filtro di visibilità Punti/Etichette (nasconde dalla vista, non elimina)
    this.hideUpperLabels = false;
    this.hideLowerLabels = false;
    this.hideNumberLabels = false;
    this.hiddenPointColors = new Set();
    this.hiddenLineWidths = new Set();
    this.hiddenLineColors = new Set();

    this.pendingLabelSnap = null;
    this.currentHoverSnap = null;
    this.contextMenuSnap = null;

    this.pendingPointSnap = null;
    this.pointCounterUpper = 0; 
    this.pointCounterLower = 0; 
    this.pointCounterNum = 1;   

    this.currentEditMode = null; 
    this.lastMouseAngle = 0;

    this.dimStart = null;
    this.dimCenter = null;
    this.dimState = 1;
    this.dimRadius = 0;
    this.dimStartAngle = 0;

    this.clipboard = [];

    this.moveState = { isMoving: false, shape: null, shapes: null, startPoint: null };
    
    this.mediaList = []; 
    this.currentMediaIndex = -1;
    this.mediaZoom = 1.0; 

    this.arcState = 1; 
    this.centerPoint = null;
    this.radius = 0;
    this.startAngle = 0;
    
    this.hoverVertex = null;
    this.debugShowAll = false;
    this.coordTop = document.getElementById('coord-top');
    this.coordLeft = document.getElementById('coord-left');
    this.TOLERANCE = 1e-6;

    this.resizeTimeout = null;

    this._init();
  }

  _init(){
    this._initPalette();
    this._bindDetachablePanels(); 
    this._bindTools();
    this._bindGridControls();
    this._bindCommandPanel(); 
    this._bindMediaControls(); 
    this._bindGridExpansion(); 
    this._bindMediaExpansion(); 
    this._bindPrintControl();
    this._bindSaveImageControl(); 
    this._bindUndoClear();
    this._bindStrokeControls(); 
    this._bindModal(); 
    this._bindPointModal();
    this._bindKeyboardShortcuts();
    this._bindProjectControls(); 
    this._bindContextMenu(); 
    this._bindTutorialControls(); 
    this._bindVisibilityFilter();

    this.autoAdjustGrid();

    document.getElementById('tool-line').classList.add('selected'); 
    document.querySelector('button[data-width="3"]').classList.add('selected'); 
    
    const defaultColorBtn = this.palette.querySelector(`button[title="Nero"]`);
    if(defaultColorBtn) defaultColorBtn.click();
    document.getElementById('data').value = (new Date()).toLocaleDateString('it-IT');
    
    window.addEventListener('resize', () => {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            if (!this.gridContainer.classList.contains('expanded-grid')) {
                this.autoAdjustGrid();
            }
        }, 100);
    });

    document.getElementById('btn-autofit').addEventListener('click', () => this.autoAdjustGrid());
    
    this._checkAutoSave();
  }

  _autoSave() {
      const projectData = {
          version: '1.0',
          timestamp: Date.now(),
          shapes: this.shapes,
          tutorialLog: this.tutorialLog, 
          settings: {
              cellSize: this.cellSizeCSS,
              isIsometric: this.isIsometric,
              isCartesian: this.isCartesian,
              cols: this.cols,
              rows: this.rows
          },
          metadata: {
              titolo: document.getElementById('titolo').value,
              cognome: document.getElementById('cognome').value,
              nome: document.getElementById('nome').value,
              classe: document.getElementById('classe').value,
              data: document.getElementById('data').value
          }
      };
      try {
          localStorage.setItem('gridArtPro_autosave', JSON.stringify(projectData));
      } catch (e) {
          console.warn("Spazio LocalStorage esaurito o non disponibile.");
      }
  }

  _checkAutoSave() {
      const savedData = localStorage.getItem('gridArtPro_autosave');
      if (savedData) {
          try {
              const parsed = JSON.parse(savedData);
              if (parsed.shapes && parsed.shapes.length > 0) {
                  document.getElementById('autosave-modal').style.display = 'flex';
                  
                  document.getElementById('btn-load-autosave').onclick = () => {
                      this._loadAutoSave(parsed);
                      document.getElementById('autosave-modal').style.display = 'none';
                  };
                  
                  document.getElementById('btn-discard-autosave').onclick = () => {
                      localStorage.removeItem('gridArtPro_autosave');
                      document.getElementById('autosave-modal').style.display = 'none';
                  };
              }
          } catch(e) {
              localStorage.removeItem('gridArtPro_autosave');
          }
      }
  }

  _loadAutoSave(data) {
      if(data.metadata) {
          document.getElementById('titolo').value = data.metadata.titolo || '';
          document.getElementById('cognome').value = data.metadata.cognome || '';
          document.getElementById('nome').value = data.metadata.nome || '';
          document.getElementById('classe').value = data.metadata.classe || '';
          document.getElementById('data').value = data.metadata.data || '';
      }

      if(data.settings) {
          this.cellSizeCSS = data.settings.cellSize || 50;
          this.isIsometric = data.settings.isIsometric || false;
          this.isCartesian = data.settings.isCartesian || false;
          this._updateGridModeButtons();
          
          const cmdPanel = document.getElementById('cartesian-console');
          if (this.isCartesian) cmdPanel.style.display = 'flex';
          else cmdPanel.style.display = 'none';
          
          this._createGrid(this.cellSizeCSS);
      }

      this.shapes = data.shapes || [];
      this.selectedShapes = [];
      
      this.tutorialLog = data.tutorialLog || [];
      // Il tutorial resta "Off" al caricamento: i passaggi registrati restano in memoria
      // (utilizzabili con Start/Avanti/Indietro/Play) ma non sovrappongono un fotogramma
      // congelato al disegno, che così rimane subito modificabile.
      this.currentTutorialIndex = -1;
      this.isRecording = false;
      this._preDemoShapes = null;
      
      if(this.tutorialLog.length > 0) {
          const tutGroup = document.getElementById('tutorial-toolbar-group');
          const btnMenu = document.getElementById('btn-toggle-tutorial-menu');
          const rect = btnMenu.getBoundingClientRect();
          tutGroup.style.display = 'flex';
          tutGroup.style.top = (rect.bottom + 10) + 'px';
          tutGroup.style.left = rect.left + 'px';
          btnMenu.classList.add('selected');
      }
      
      document.getElementById('btn-tut-rec').innerHTML = '🔴 Rec';
      document.getElementById('btn-tut-rec').classList.remove('selected');
      const tutUndoBtn = document.getElementById('btn-tut-undo-rec');
      if (tutUndoBtn) tutUndoBtn.style.display = 'none';

      this._updateGhostShapes();
      this._updateTutorialStatus();

      this._redrawPermShapes();
      this.arcStatusSpan.textContent = "Lavoro ripristinato.";
      setTimeout(()=> this.arcStatusSpan.textContent = "", 2000);
  }

  _bindDetachablePanels() {
      const panels = [
          { panelId: 'panel-grid-options', headerId: 'header-grid-options', btnId: 'detach-grid-options' },
          { panelId: 'panel-media', headerId: 'header-media', btnId: 'detach-media' },
          { panelId: 'panel-data', headerId: 'header-data', btnId: 'detach-data' },
          { panelId: 'tutorial-toolbar-group', headerId: 'header-tutorial', btnId: 'detach-tutorial' }
      ];

      panels.forEach(p => {
          const panel = document.getElementById(p.panelId);
          const header = document.getElementById(p.headerId);
          const detachBtn = document.getElementById(p.btnId);
          if (!panel || !header || !detachBtn) return;

          let isDragging = false;
          let startX, startY;

          const dragStart = (e) => {
              if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
              if (!panel.classList.contains('detached-panel')) return; 

              isDragging = true;
              const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
              const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
              
              const rect = panel.getBoundingClientRect();
              startX = clientX - rect.left;
              startY = clientY - rect.top;
          };

          const dragMove = (e) => {
              if (!isDragging) return;
              if(e.cancelable) e.preventDefault(); 
              const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
              const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
              
              panel.style.left = (clientX - startX) + 'px';
              panel.style.top = (clientY - startY) + 'px';
              panel.style.right = 'auto';
              panel.style.bottom = 'auto';
          };

          const dragEnd = () => { isDragging = false; };

          header.addEventListener('mousedown', dragStart);
          header.addEventListener('touchstart', dragStart, {passive: false});
          window.addEventListener('mousemove', dragMove);
          window.addEventListener('touchmove', dragMove, {passive: false});
          window.addEventListener('mouseup', dragEnd);
          window.addEventListener('touchend', dragEnd);

          detachBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              if (panel.classList.contains('detached-panel')) {
                  panel.classList.remove('detached-panel');
                  panel.style.left = ''; panel.style.top = ''; panel.style.right = ''; panel.style.bottom = '';
                  detachBtn.textContent = '✥ Sgancia';
                  detachBtn.title = 'Sgancia pannello';
                  if(p.panelId === 'tutorial-toolbar-group') {
                      panel.style.display = 'none';
                      document.getElementById('btn-toggle-tutorial-menu').classList.remove('selected');
                  }
              } else {
                  panel.classList.add('detached-panel');
                  const rect = panel.getBoundingClientRect();
                  panel.style.left = rect.left + 'px';
                  panel.style.top = rect.top + 'px';
                  detachBtn.textContent = '📌 Aggancia';
                  detachBtn.title = 'Aggancia alla barra';
              }
          });
      });
  }

  _bindTutorialControls() {
      const btnToggleMenu = document.getElementById('btn-toggle-tutorial-menu');
      const tutGroup = document.getElementById('tutorial-toolbar-group');
      
      const btnRec = document.getElementById('btn-tut-rec');
      const btnTutUndo = document.getElementById('btn-tut-undo-rec');
      const btnGhost = document.getElementById('btn-tut-ghost');
      const btnStart = document.getElementById('btn-tut-start');
      const btnPrev = document.getElementById('btn-tut-prev');
      const btnNext = document.getElementById('btn-tut-next');
      const btnPlay = document.getElementById('btn-tut-play');
      const btnStop = document.getElementById('btn-tut-stop');
      const btnFlatten = document.getElementById('btn-tut-flatten');

      btnToggleMenu.addEventListener('click', (e) => {
          if (tutGroup.style.display === 'none' || tutGroup.style.display === '') {
              const rect = e.currentTarget.getBoundingClientRect();
              tutGroup.style.display = 'flex';
              if (!tutGroup.classList.contains('detached-panel')) {
                  tutGroup.style.top = (rect.bottom + 10) + 'px';
                  tutGroup.style.left = rect.left + 'px';
              }
              e.currentTarget.classList.add('selected');
          } else {
              tutGroup.style.display = 'none';
              e.currentTarget.classList.remove('selected');
          }
      });

      btnRec.addEventListener('click', () => {
          this.isRecording = !this.isRecording;
          if (this.isRecording) {
              this.tutorialLog = []; 
              this._preDemoShapes = null; // una nuova registrazione invalida un eventuale backup precedente
              if(this.shapes.length > 0) {
                  this.tutorialLog.push(JSON.parse(JSON.stringify(this.shapes)));
              }
              this.currentTutorialIndex = this.tutorialLog.length > 0 ? 0 : -1;
              btnRec.innerHTML = '⏹️ Stop';
              btnRec.classList.add('selected');
              btnTutUndo.style.display = 'inline-block'; 
              this.pauseTutorial();
          } else {
              btnRec.innerHTML = '🔴 Rec';
              btnRec.classList.remove('selected');
              btnTutUndo.style.display = 'none'; 
              // Fine registrazione: torna in modalità "Tutorial Off" così il disegno
              // resta pienamente modificabile. I passaggi registrati (tutorialLog)
              // NON vengono cancellati: restano disponibili tramite Start/Avanti/Indietro/Play.
              this.currentTutorialIndex = -1;
              this._updateGhostShapes();
              this._redrawPermShapes();
          }
          this._updateTutorialStatus();
          this._autoSave();
      });

      btnTutUndo.addEventListener('click', () => {
          if (this.isRecording && this.tutorialLog.length > 0) {
              this.tutorialLog.pop();
              if (this.tutorialLog.length > 0) {
                  this.shapes = JSON.parse(JSON.stringify(this.tutorialLog[this.tutorialLog.length - 1]));
              } else {
                  this.shapes = []; 
              }
              this.currentTutorialIndex = this.tutorialLog.length - 1;
              this._updateTutorialStatus();
              this._redrawPermShapes();
              this._autoSave();
          }
      });

      btnGhost.addEventListener('click', () => {
          this.isGhostMode = !this.isGhostMode;
          btnGhost.classList.toggle('selected', this.isGhostMode);
          if (this.isGhostMode && this.currentTutorialIndex === -1 && this.tutorialLog.length > 0) {
              this.currentTutorialIndex = 0; 
          }
          this._updateGhostShapes();
          this._redrawPermShapes();
          this._updateTutorialStatus();
      });

      btnStart.addEventListener('click', () => {
          this.pauseTutorial();
          
          // Salva il disegno reale attuale (solo la prima volta) per poterlo
          // ripristinare quando la dimostrazione viene chiusa (⏹️ Stop).
          if (this._preDemoShapes === null) {
              this._preDemoShapes = JSON.parse(JSON.stringify(this.shapes));
          }

          this.shapes = [];
          this.redoShapes = [];
          this.currentPolygonPoints = [];
          this.selectedShapes = [];
          this._clearPreview();

          if (this.tutorialLog.length > 0) {
              this.currentTutorialIndex = -1; 
              this._updateGhostShapes();
              this._redrawPermShapes();
              this._updateTutorialStatus();
          } else {
              this._redrawPermShapes();
          }
      });

      btnPrev.addEventListener('click', () => {
          this.pauseTutorial();
          if (this.currentTutorialIndex >= 0) {
              this.currentTutorialIndex--;
              this._updateGhostShapes();
              this._redrawPermShapes();
              this._updateTutorialStatus();
          }
      });

      btnNext.addEventListener('click', () => {
          this.pauseTutorial();
          this._stepTutorialNext();
      });

      btnPlay.addEventListener('click', () => {
          if (this.playInterval) {
              this.pauseTutorial();
          } else {
              if (this.tutorialLog.length === 0) return;
              
              if (this.currentTutorialIndex >= this.tutorialLog.length - 1) {
                  this.currentTutorialIndex = -1; 
              }

              btnPlay.innerHTML = '⏸️';
              btnPlay.classList.add('selected');
              
              this.playInterval = setInterval(() => {
                  this._stepTutorialNext();
                  if (this.currentTutorialIndex >= this.tutorialLog.length - 1) {
                      this.pauseTutorial();
                  }
              }, 1200); 
          }
      });

      btnStop.addEventListener('click', () => {
          this.pauseTutorial();
          this.currentTutorialIndex = -1; 

          // Ripristina il disegno reale così com'era prima di "Ricomincia da zero" (⏪),
          // pronto per essere modificato con i normali comandi Undo/Redo.
          if (this._preDemoShapes !== null) {
              this.shapes = this._preDemoShapes;
              this._preDemoShapes = null;
              this.redoShapes = [];
          }

          this._updateGhostShapes();
          this._redrawPermShapes();
          this._updateTutorialStatus();
      });

      btnFlatten.addEventListener('click', () => {
          if (!this.tutorialLog || this.tutorialLog.length === 0) {
              alert("Non c'è nessun tutorial registrato da appiattire.");
              return;
          }
          const ok = confirm(
              "Questo comando crea un disegno completo con TUTTE le forme comparse durante " +
              "il tutorial (comprese quelle poi cancellate durante la registrazione), navigabile " +
              "con i normali comandi Undo/Redo (↩️/↪️), e rimuove definitivamente i dati del " +
              "Tutorial (registrazione e riproduzione guidata) da questo progetto.\n\n" +
              "Vuoi continuare?"
          );
          if (!ok) return;

          this.pauseTutorial();

          // Unione cronologica di tutte le forme mai comparse in un passaggio del tutorial,
          // ciascuna una sola volta, nell'ordine in cui è comparsa per la prima volta.
          // In questo modo restano incluse anche le forme cancellate durante la registrazione.
          const seen = new Set();
          const union = [];
          this.tutorialLog.forEach(frame => {
              frame.forEach(shape => {
                  const key = JSON.stringify(shape);
                  if (!seen.has(key)) { seen.add(key); union.push(shape); }
              });
          });
          // Includiamo anche eventuali forme presenti nel disegno attuale ma non ancora
          // registrate in nessun passaggio (es. modifiche fatte dopo aver chiuso il tutorial).
          this.shapes.forEach(shape => {
              const key = JSON.stringify(shape);
              if (!seen.has(key)) { seen.add(key); union.push(shape); }
          });

          this.shapes = union;
          this.redoShapes = [];
          this.selectedShapes = [];
          this.eraseSelectedBtn.style.display = 'none';

          // Rimuove i dati del Tutorial: da qui in avanti è un disegno normale,
          // navigabile solo con Undo/Redo standard.
          this.tutorialLog = [];
          this.currentTutorialIndex = -1;
          this.ghostShapes = [];
          this.isRecording = false;
          this._preDemoShapes = null;
          btnRec.innerHTML = '🔴 Rec';
          btnRec.classList.remove('selected');
          btnTutUndo.style.display = 'none';

          this._updateGhostShapes();
          this._redrawPermShapes();
          this._updateTutorialStatus();
          this._saveStateForTutorial();

          alert(
              `Fatto! Il disegno ora contiene ${this.shapes.length} forme, comprese quelle ` +
              `cancellate durante il tutorial. Usa Undo/Redo per scorrerle avanti e indietro, ` +
              `poi salva il progetto (💾) per ottenere il file pulito, senza dati di Tutorial.`
          );
      });
  }

  pauseTutorial() {
      if (this.playInterval) {
          clearInterval(this.playInterval);
          this.playInterval = null;
          const btnPlay = document.getElementById('btn-tut-play');
          btnPlay.innerHTML = '▶️';
          btnPlay.classList.remove('selected');
      }
  }

  _stepTutorialNext() {
      if (this.currentTutorialIndex < this.tutorialLog.length - 1) {
          this.currentTutorialIndex++;
          this._updateGhostShapes();
          this._redrawPermShapes();
          this._updateTutorialStatus();
      }
  }

  _updateGhostShapes() {
      if (this.currentTutorialIndex >= 0 && this.currentTutorialIndex < this.tutorialLog.length) {
          this.ghostShapes = this.tutorialLog[this.currentTutorialIndex];
      } else {
          this.ghostShapes = [];
      }
  }

  _updateTutorialStatus() {
      const status = document.getElementById('tutorial-status');
      if (this.isRecording) {
          status.textContent = `🔴 REC (${this.tutorialLog.length})`;
          status.style.color = 'red';
      } else if (this.isGhostMode && this.currentTutorialIndex >= 0 && this.tutorialLog.length > 0) {
          status.textContent = `Ghost ${this.currentTutorialIndex + 1}/${this.tutorialLog.length}`;
          status.style.color = '#246eb9';
      } else if (!this.isGhostMode && this.currentTutorialIndex >= 0 && this.tutorialLog.length > 0) {
          status.textContent = `Demo ${this.currentTutorialIndex + 1}/${this.tutorialLog.length}`;
          status.style.color = '#2ecc71';
      } else {
          status.textContent = `Tut. Off (${this.tutorialLog.length})`;
          status.style.color = '#e67e22';
      }
  }

  _saveStateForTutorial() {
      if (this.isRecording) {
          this.tutorialLog.push(JSON.parse(JSON.stringify(this.shapes)));
          this.currentTutorialIndex = this.tutorialLog.length - 1;
          this._updateGhostShapes(); 
          this._updateTutorialStatus();
      }
      this._autoSave(); 
  }

  _bindCommandPanel() {
      const input = document.getElementById('cmd-input');
      const btn = document.getElementById('cmd-btn');
      const helpBtn = document.getElementById('cmd-help-btn');

      helpBtn.addEventListener('click', () => {
          alert("COMANDI GEOMETRICI SUPPORTATI:\n\n" +
                "• Punto:  P(x, y)  -> es. P(2, -3) (Etichetta automatica A, B, C...)\n" +
                "• Linea:  L(x1, y1, x2, y2)  -> es. L(-1, 2, 4, 3)\n" +
                "• Cerchio: C(x, y, raggio)  -> es. C(0, 0, 5)\n" +
                "• Arco: A(x, y, raggio, ang_inizio, ang_fine) -> es. A(0, 0, 5, 0, 90)\n\n" +
                "I colori e gli spessori saranno presi da quelli attualmente selezionati nella palette a destra.");
      });

      const executeCmd = () => {
          const cmd = input.value.trim().toUpperCase().replace(/\s+/g, ''); 
          if (!cmd) return;

          const midX = Math.floor(this.cols / 2);
          const midY = Math.floor(this.rows / 2);
          const cs = this.cellSizeCSS;

          const matchP = cmd.match(/^P\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)$/);
          const matchL = cmd.match(/^L\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)$/);
          const matchC = cmd.match(/^C\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?)\)$/);
          const matchA = cmd.match(/^A\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)$/);

          let success = false;

          if (matchP) {
              const x = parseFloat(matchP[1]);
              const y = parseFloat(matchP[2]);
              const canvasX = (midX + x) * cs;
              const canvasY = (midY - y) * cs; 

              this.shapes.push({ type: 'point', x: canvasX, y: canvasY, color: this.selectedColor.hex, width: this.strokeWidth });
              
              let labelText = String.fromCharCode(65 + this.pointCounterUpper); 
              this.pointCounterUpper++;
              if (this.pointCounterUpper > 25) this.pointCounterUpper = 0; 
              
              const finalSize = Math.max(10, this.strokeWidth * 4);
              this.shapes.push({ type: 'label', x: canvasX + 8, y: canvasY - 8, text: labelText, color: this.selectedColor.hex, size: finalSize, font: 'Inter, sans-serif', isBold: this.isBold });
              success = true;

          } else if (matchL) {
              const x1 = parseFloat(matchL[1]);
              const y1 = parseFloat(matchL[2]);
              const x2 = parseFloat(matchL[3]);
              const y2 = parseFloat(matchL[4]);

              this.shapes.push({
                  type: 'line', 
                  x1: (midX + x1) * cs, y1: (midY - y1) * cs, 
                  x2: (midX + x2) * cs, y2: (midY - y2) * cs,
                  color: this.selectedColor.hex, width: this.strokeWidth, dashed: this.isDashed,
                  arrowStart: this.isArrowStart, arrowEnd: this.isArrowEnd
              });
              success = true;

          } else if (matchC) {
              const cx = parseFloat(matchC[1]);
              const cy = parseFloat(matchC[2]);
              const r = parseFloat(matchC[3]);

              this.shapes.push({
                  type: 'arc', 
                  cx: (midX + cx) * cs, cy: (midY - cy) * cs, r: r * cs,
                  start: 0, end: Math.PI * 2, counterClockwise: false,
                  color: this.selectedColor.hex, width: this.strokeWidth, filled: false, dashed: this.isDashed
              });
              success = true;
              
          } else if (matchA) {
              const cx = parseFloat(matchA[1]);
              const cy = parseFloat(matchA[2]);
              const r = parseFloat(matchA[3]);
              const startDeg = parseFloat(matchA[4]);
              const endDeg = parseFloat(matchA[5]);
              
              const startRad = -startDeg * Math.PI / 180;
              const endRad = -endDeg * Math.PI / 180;

              this.shapes.push({
                  type: 'arc', 
                  cx: (midX + cx) * cs, cy: (midY - cy) * cs, r: r * cs,
                  start: startRad, end: endRad, 
                  counterClockwise: true, 
                  color: this.selectedColor.hex, width: this.strokeWidth, filled: false, dashed: this.isDashed
              });
              success = true;
          }

          if (success) {
              this.redoShapes = [];
              this._saveStateForTutorial();
              this._redrawPermShapes();
              input.value = '';
              input.focus();
              this.arcStatusSpan.textContent = "Comando Eseguito";
              setTimeout(() => { if(this.arcStatusSpan.textContent === "Comando Eseguito") this.arcStatusSpan.textContent = ""; }, 2000);
          } else {
              alert("Comando non riconosciuto o sintassi errata.\nClicca sul tasto '?' per vedere la guida.");
          }
      };

      btn.addEventListener('click', executeCmd);
      input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') executeCmd();
      });
  }

  _bindPointModal() {
      const modal = document.getElementById('point-type-modal');
      const btnOk = document.getElementById('modal-point-btn-ok');
      const btnCancel = document.getElementById('modal-point-btn-cancel');
      const btnReset = document.getElementById('modal-point-btn-reset');

      const confirm = () => {
          const type = document.querySelector('input[name="point-label-type"]:checked').value;
          
          if (this.pendingPointSnap) {
              this.shapes.push({
                  type: 'point', x: this.pendingPointSnap.x, y: this.pendingPointSnap.y,
                  color: this.selectedColor.hex, width: this.strokeWidth
              });

              let labelText = "";
              if (type === 'uppercase') {
                  labelText = String.fromCharCode(65 + this.pointCounterUpper); 
                  this.pointCounterUpper++;
                  if (this.pointCounterUpper > 25) this.pointCounterUpper = 0; 
              } else if (type === 'lowercase') {
                  labelText = String.fromCharCode(97 + this.pointCounterLower); 
                  this.pointCounterLower++;
                  if (this.pointCounterLower > 25) this.pointCounterLower = 0; 
              } else if (type === 'number') {
                  labelText = this.pointCounterNum.toString();
                  this.pointCounterNum++;
              }

              if (labelText !== "") {
                  const finalSize = Math.max(10, this.strokeWidth * 4);
                  this.shapes.push({
                      type: 'label', 
                      x: this.pendingPointSnap.x + 8, 
                      y: this.pendingPointSnap.y - 8,
                      text: labelText, 
                      color: this.selectedColor.hex, 
                      size: finalSize, 
                      font: 'Inter, sans-serif',
                      isBold: this.isBold
                  });
              }

              this.redoShapes = [];
              this._saveStateForTutorial();
              this._redrawPermShapes();
              this.arcStatusSpan.textContent = "Punto Inserito";
              setTimeout(() => { if(this.arcStatusSpan.textContent === "Punto Inserito") this.arcStatusSpan.textContent = ""; }, 1500);
          }
          
          modal.style.display = 'none';
          this.pendingPointSnap = null;
          window.focus(); 
      };

      btnReset.addEventListener('click', () => {
          this.pointCounterUpper = 0;
          this.pointCounterLower = 0;
          this.pointCounterNum = 1;
          this.arcStatusSpan.textContent = "Contatori azzerati";
          setTimeout(() => { if(this.arcStatusSpan.textContent === "Contatori azzerati") this.arcStatusSpan.textContent = ""; }, 1500);
      });

      btnOk.addEventListener('click', confirm);
      btnCancel.addEventListener('click', () => {
          modal.style.display = 'none';
          this.pendingPointSnap = null;
      });
      modal.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') confirm();
          if (e.key === 'Escape') btnCancel.click();
      });
  }

  _bindModal() {
      const modal = document.getElementById('text-prompt-modal');
      const btnOk = document.getElementById('modal-btn-ok');
      const btnCancel = document.getElementById('modal-btn-cancel');
      const input = document.getElementById('modal-text-input');
      const checkBold = document.getElementById('modal-bold-checkbox');
      const checkPoint = document.getElementById('modal-point-checkbox');
      const checkSideLeft = document.getElementById('modal-side-left-checkbox');
      const checkSideRight = document.getElementById('modal-side-right-checkbox');
      const symBtns = document.querySelectorAll('.sym-btn');

      // "S" e "D" si comportano come una scelta unica: selezionandone una si deseleziona l'altra.
      if (checkSideLeft && checkSideRight) {
          checkSideLeft.addEventListener('change', () => {
              if (checkSideLeft.checked) checkSideRight.checked = false;
          });
          checkSideRight.addEventListener('change', () => {
              if (checkSideRight.checked) checkSideLeft.checked = false;
          });
      }

      symBtns.forEach(btn => {
          btn.addEventListener('click', (e) => {
              const char = e.target.dataset.char || e.target.textContent;
              const start = input.selectionStart;
              const end = input.selectionEnd;
              input.value = input.value.substring(0, start) + char + input.value.substring(end);
              input.focus();
              input.setSelectionRange(start + char.length, start + char.length);
          });
      });

      const confirm = () => {
          const text = input.value;
          const hasText = text && text.trim() !== "";
          const includePoint = !!(checkPoint && checkPoint.checked);

          if ((hasText || includePoint) && this.pendingLabelSnap) {
              this.isBold = checkBold.checked; 
              const finalSize = Math.max(8, this.strokeWidth * 4);
              let labelX = this.pendingLabelSnap.x;
              let labelY = this.pendingLabelSnap.y;

              if (includePoint) {
                  this.shapes.push({
                      type: 'point', x: this.pendingLabelSnap.x, y: this.pendingLabelSnap.y,
                      color: this.selectedColor.hex, width: this.strokeWidth
                  });
                  const placeLeft = !!(checkSideLeft && checkSideLeft.checked);
                  const GAP = 8;
                  if (placeLeft && hasText && this.permCtx) {
                      // Il testo si disegna sempre con textAlign 'left' (ancoraggio a sinistra),
                      // quindi per metterlo a sinistra del punto senza sovrapporlo dobbiamo
                      // spostare l'ancora della larghezza del testo stesso + lo stesso distacco usato per D.
                      const fontWeight = this.isBold ? 'bold' : 'normal';
                      this.permCtx.font = `${fontWeight} ${finalSize * 1.1}px Inter, sans-serif`;
                      const textWidth = this.permCtx.measureText(text.trim().substring(0, 50)).width;
                      labelX = this.pendingLabelSnap.x - GAP - textWidth;
                  } else {
                      labelX = this.pendingLabelSnap.x + (placeLeft ? -GAP : GAP);
                  }
                  labelY = this.pendingLabelSnap.y - 8;
              }

              if (hasText) {
                  this.shapes.push({
                      type: 'label', x: labelX, y: labelY,
                      text: text.trim().substring(0, 50), color: this.selectedColor.hex, size: finalSize, font: 'Inter, sans-serif',
                      isBold: this.isBold
                  });
              }

              this.redoShapes = [];
              this._saveStateForTutorial();
              this._redrawPermShapes();
          }
          modal.style.display = 'none';
          this.pendingLabelSnap = null;
      };

      btnOk.addEventListener('click', confirm);
      btnCancel.addEventListener('click', () => {
          modal.style.display = 'none';
          this.pendingLabelSnap = null;
      });
      input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') confirm();
          if (e.key === 'Escape') btnCancel.click();
      });
  }

  _updateTooltip(label, value, unit, clientX, clientY, mode) {
      if (!this.dynamicTooltip) return;
      this.dynamicTooltip.style.display = 'flex';
      
      document.getElementById('measure-label').textContent = label;
      document.getElementById('measure-unit').textContent = unit;
      
      const input = document.getElementById('measure-input');
      if (document.activeElement !== input) {
          input.value = value;
      }
      
      this.dynamicTooltip.style.left = (clientX + 15) + 'px';
      this.dynamicTooltip.style.top = (clientY + 15) + 'px';
      
      this.currentEditMode = mode; 
  }

  _hideTooltip() {
      if (this.dynamicTooltip) this.dynamicTooltip.style.display = 'none';
      this.currentEditMode = null;
      document.getElementById('measure-input').blur();
  }

  _finalizeDimensionFromInput(val) {
      if (isNaN(val) || val === null) return;

      if (this.currentEditMode === 'line' && this.lineStart) {
          const px = val * this.cellSizeCSS;
          const finalX = this.lineStart.x + px * Math.cos(this.lastMouseAngle);
          const finalY = this.lineStart.y + px * Math.sin(this.lastMouseAngle);
          
          this.shapes.push({ 
              type: 'line', x1: this.lineStart.x, y1: this.lineStart.y, x2: finalX, y2: finalY, 
              color: this.selectedColor.hex, width: this.strokeWidth, dashed: this.isDashed,
              arrowStart: this.isArrowStart, arrowEnd: this.isArrowEnd 
          });
          this.redoShapes = [];
          this._saveStateForTutorial();
          this._redrawPermShapes();
          this.lineStart = null;
          this.isDrawingLine = false;
          this._clearPreview();
          this._hideTooltip();
          this.arcStatusSpan.textContent = 'Inizio Linea';
      } 
      else if (this.currentEditMode === 'radius' && this.centerPoint) {
          this.radius = val * this.cellSizeCSS;
          if (this.tool === 'circle') {
              this.shapes.push({
                  type: 'arc', cx: this.centerPoint.x, cy: this.centerPoint.y,
                  r: this.radius, start: 0, end: Math.PI * 2, counterClockwise: false,
                  color: this.selectedColor.hex, width: this.strokeWidth, filled: false, dashed: this.isDashed
              });
              this.redoShapes = [];
              this._saveStateForTutorial();
              this._redrawPermShapes();
              this._resetArc(true);
          } else {
              this.startAngle = this.lastMouseAngle || 0;
              this.arcState = 3;
              this.arcStatusSpan.textContent = 'Fine (Angolo)';
              document.getElementById('measure-input').blur();
          }
      }
      else if (this.currentEditMode === 'angle' && this.centerPoint) {
          let diffRad = val * Math.PI / 180;
          let finalEndAngle = this.startAngle + (this.isCounterClockwise ? -diffRad : diffRad);
          
          this.shapes.push({
                type: 'arc', cx: this.centerPoint.x, cy: this.centerPoint.y,
                r: this.radius, start: this.startAngle, end: finalEndAngle, counterClockwise: this.isCounterClockwise,
                color: this.selectedColor.hex, width: this.strokeWidth, filled: (this.tool==='arc-fill'), dashed: this.isDashed
          });
          this.redoShapes = [];
          this._saveStateForTutorial();
          this._redrawPermShapes();
          this._resetArc(true);
      }
  }

  _bindContextMenu() {
      const menu = document.getElementById('context-menu');
      const btnFront = document.getElementById('btn-bring-front');
      const btnBack = document.getElementById('btn-send-back');
      const ctxFront = document.getElementById('ctx-front');
      const ctxBack = document.getElementById('ctx-back');
      const ctxDelete = document.getElementById('ctx-delete');
      const ctxBold = document.getElementById('ctx-bold');
      const ctxDivText = document.getElementById('ctx-div-text');
      const ctxInsertPoint = document.getElementById('ctx-insert-point');
      const ctxDivMain = document.getElementById('ctx-div-main');
      const ctxDivDelete = document.getElementById('ctx-div-delete');

      this.grid.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          const rect = this.grid.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickY = e.clientY - rect.top;
          
          const snap = this._getSnapPoint(e.clientX, e.clientY, false);
          this.contextMenuSnap = snap; 

          if(this.selectedShapes.length === 0) {
              const idx = this._findShapeIndexAt(clickX, clickY);
              if(idx !== -1) {
                  this.selectedShapes = [idx];
                  this._redrawPermShapes();
              }
          }

          const isSelected = this.selectedShapes.length > 0;

          if (isSelected) {
              const hasText = this.selectedShapes.some(idx => this.shapes[idx].type === 'label');
              
              ctxInsertPoint.style.display = 'none';
              ctxDivMain.style.display = 'block';
              ctxFront.style.display = 'flex';
              ctxBack.style.display = 'flex';
              ctxDivDelete.style.display = 'block';
              ctxDelete.style.display = 'flex';
              
              if (ctxDivText && ctxBold) {
                  ctxDivText.style.display = hasText ? 'block' : 'none';
                  ctxBold.style.display = hasText ? 'flex' : 'none';
              }
          } else {
              ctxInsertPoint.style.display = 'flex';
              ctxDivMain.style.display = 'none';
              ctxFront.style.display = 'none';
              ctxBack.style.display = 'none';
              if (ctxDivText) ctxDivText.style.display = 'none';
              if (ctxBold) ctxBold.style.display = 'none';
              ctxDivDelete.style.display = 'none';
              ctxDelete.style.display = 'none';
          }

          menu.style.display = 'block';
          menu.style.left = e.clientX + 'px';
          menu.style.top = e.clientY + 'px';
      });

      window.addEventListener('click', () => {
          menu.style.display = 'none';
      });

      const reorderSelection = (direction) => {
          if (this.selectedShapes.length === 0) return;
          
          const selectedObjs = this.selectedShapes.map(idx => this.shapes[idx]);
          const remainingObjs = this.shapes.filter((_, idx) => !this.selectedShapes.includes(idx));
          
          if (direction === 'front') {
              this.shapes = [...remainingObjs, ...selectedObjs];
              const startIdx = remainingObjs.length;
              this.selectedShapes = selectedObjs.map((_, i) => startIdx + i);
          } else {
              this.shapes = [...selectedObjs, ...remainingObjs];
              this.selectedShapes = selectedObjs.map((_, i) => i);
          }
          
          this._saveStateForTutorial();
          this._redrawPermShapes();
          menu.style.display = 'none';
      };

      btnFront.addEventListener('click', () => reorderSelection('front'));
      btnBack.addEventListener('click', () => reorderSelection('back'));

      ctxFront.addEventListener('click', () => reorderSelection('front'));
      ctxBack.addEventListener('click', () => reorderSelection('back'));
      
      if (ctxBold) {
          ctxBold.addEventListener('click', () => {
              if (this.selectedShapes.length === 0) return;
              this.selectedShapes.forEach(idx => {
                  if (this.shapes[idx].type === 'label') {
                      this.shapes[idx].isBold = !(this.shapes[idx].isBold !== false);
                  }
              });
              this._saveStateForTutorial();
              this._redrawPermShapes();
              menu.style.display = 'none';
          });
      }

      ctxInsertPoint.addEventListener('click', () => {
          this.pendingPointSnap = this.contextMenuSnap;
          document.getElementById('point-type-modal').style.display = 'flex';
          document.getElementById('modal-point-btn-ok').focus();
          menu.style.display = 'none';
      });

      ctxDelete.addEventListener('click', () => {
          this._eraseSelectedShapes();
          menu.style.display = 'none';
      });
  }

  _bindGridExpansion() {
      const expandBtn = document.getElementById('expand-grid-btn');
      const closeBtn = document.getElementById('close-grid-expanded-btn');
      const handle = document.getElementById('grid-drag-handle');
      const container = this.gridContainer;
      
      const zoomInBtn = document.getElementById('btn-zoom-in');
      const zoomOutBtn = document.getElementById('btn-zoom-out');

      const toggleGridExpand = () => {
          const isExpanded = container.classList.contains('expanded-grid');
          if (isExpanded) {
              container.classList.remove('expanded-grid');
              expandBtn.innerHTML = '🔲';
              expandBtn.classList.remove('selected');
              container.style.top = ''; 
              container.style.left = ''; 
              container.style.width = ''; 
              container.style.height = ''; 
              container.style.transform = '';
              this.autoAdjustGrid();
          } else {
              container.classList.add('expanded-grid');
              expandBtn.innerHTML = 'Riduci';
              expandBtn.classList.add('selected');
              container.style.top = '50%'; 
              container.style.left = '50%'; 
              container.style.transform = 'translate(-50%, -50%)';
          }
      };

      expandBtn.addEventListener('click', toggleGridExpand);
      closeBtn.addEventListener('click', toggleGridExpand);

      const applyZoom = (delta) => {
          let newSize = this.cellSizeCSS + delta;
          if (newSize < CONFIG.minCellSize) newSize = CONFIG.minCellSize;
          if (newSize > CONFIG.maxCellSize) newSize = CONFIG.maxCellSize;
          this._createGrid(newSize);
      };

      zoomInBtn.addEventListener('click', () => applyZoom(5));
      zoomOutBtn.addEventListener('click', () => applyZoom(-5));

      container.addEventListener('wheel', (e) => {
          if (!container.classList.contains('expanded-grid')) return;
          if (e.ctrlKey || Math.abs(e.deltaY) > 0) {
              e.preventDefault();
              const delta = e.deltaY > 0 ? -5 : 5;
              applyZoom(delta);
          }
      }, { passive: false });

      let isDragging = false;
      let dragOffsetX = 0;
      let dragOffsetY = 0;

      const handleDragStart = (e) => {
          if (!container.classList.contains('expanded-grid')) return;
          if (e.target.tagName === 'BUTTON') return;
          
          isDragging = true;
          if (e.pointerId) handle.setPointerCapture(e.pointerId);
          
          const clientX = e.clientX || (e.touches && e.touches[0].clientX);
          const clientY = e.clientY || (e.touches && e.touches[0].clientY);
          
          const rect = container.getBoundingClientRect();
          dragOffsetX = clientX - rect.left;
          dragOffsetY = clientY - rect.top;
          
          container.style.transform = 'none';
          container.style.left = rect.left + 'px';
          container.style.top = rect.top + 'px';
          handle.style.cursor = 'grabbing';
      };

      const handleDragMove = (e) => {
          if (!isDragging) return;
          if(e.cancelable) e.preventDefault(); 
          const clientX = e.clientX || (e.touches && e.touches[0].clientX);
          const clientY = e.clientY || (e.touches && e.touches[0].clientY);
          
          container.style.left = (clientX - dragOffsetX) + 'px';
          container.style.top = (clientY - dragOffsetY) + 'px';
      };

      const handleDragEnd = () => {
          if (isDragging) {
              isDragging = false;
              handle.style.cursor = 'move';
          }
      };

      handle.addEventListener('pointerdown', handleDragStart);
      window.addEventListener('pointermove', handleDragMove, {passive: false});
      window.addEventListener('pointerup', handleDragEnd);
      window.addEventListener('pointercancel', handleDragEnd);
  }

  _bindMediaExpansion() {
      const expandBtn = document.getElementById('toggle-expand-btn');
      const closeBtn = document.getElementById('close-media-expanded-btn'); 
      const handle = document.getElementById('media-drag-handle');
      const wrapper = document.getElementById('media-wrapper');
      
      const zoomInBtn = document.getElementById('btn-media-zoom-in');
      const zoomOutBtn = document.getElementById('btn-media-zoom-out');

      const toggleMediaExpand = () => {
          const isExpanded = wrapper.classList.contains('expanded');
          if (isExpanded) {
              wrapper.classList.remove('expanded');
              expandBtn.textContent = '🔲 Finestra';
              expandBtn.classList.remove('selected');
              wrapper.style.top = ''; wrapper.style.left = ''; wrapper.style.width = ''; wrapper.style.height = ''; wrapper.style.transform = '';
              this.mediaZoom = 1.0;
              this._updateMediaZoom();
          } else {
              wrapper.classList.add('expanded');
              expandBtn.textContent = 'Riduci';
              expandBtn.classList.add('selected');
              wrapper.style.top = '50%'; wrapper.style.left = '50%'; wrapper.style.transform = 'translate(-50%, -50%)';
          }
      };

      expandBtn.addEventListener('click', toggleMediaExpand);
      if(closeBtn) closeBtn.addEventListener('click', toggleMediaExpand);

      const applyMediaZoom = (delta) => {
          this.mediaZoom += delta;
          if(this.mediaZoom < 0.1) this.mediaZoom = 0.1;
          if(this.mediaZoom > 5.0) this.mediaZoom = 5.0;
          this._updateMediaZoom();
      };

      if(zoomInBtn) zoomInBtn.addEventListener('click', () => applyMediaZoom(0.1));
      if(zoomOutBtn) zoomOutBtn.addEventListener('click', () => applyMediaZoom(-0.1));

      wrapper.addEventListener('wheel', (e) => {
          if (!wrapper.classList.contains('expanded')) return;
          if (e.ctrlKey || Math.abs(e.deltaY) > 0) {
              e.preventDefault();
              const delta = e.deltaY > 0 ? -0.1 : 0.1;
              applyMediaZoom(delta);
          }
      }, { passive: false });

      let isDragging = false;
      let dragOffsetX = 0;
      let dragOffsetY = 0;

      const handleDragStart = (e) => {
          if (!wrapper.classList.contains('expanded')) return;
          if (e.target.tagName === 'BUTTON') return;
          
          isDragging = true;
          if (e.pointerId) handle.setPointerCapture(e.pointerId);
          
          const clientX = e.clientX || (e.touches && e.touches[0].clientX);
          const clientY = e.clientY || (e.touches && e.touches[0].clientY);
          
          const rect = wrapper.getBoundingClientRect();
          dragOffsetX = clientX - rect.left;
          dragOffsetY = clientY - rect.top;
          
          wrapper.style.transform = 'none';
          wrapper.style.left = rect.left + 'px';
          wrapper.style.top = rect.top + 'px';
          handle.style.cursor = 'grabbing';
      };

      const handleDragMove = (e) => {
          if (!isDragging) return;
          if(e.cancelable) e.preventDefault();
          const clientX = e.clientX || (e.touches && e.touches[0].clientX);
          const clientY = e.clientY || (e.touches && e.touches[0].clientY);
          
          wrapper.style.left = (clientX - dragOffsetX) + 'px';
          wrapper.style.top = (clientY - dragOffsetY) + 'px';
      };

      const handleDragEnd = () => {
          if (isDragging) {
              isDragging = false;
              handle.style.cursor = 'move';
          }
      };

      handle.addEventListener('pointerdown', handleDragStart);
      window.addEventListener('pointermove', handleDragMove, {passive: false});
      window.addEventListener('pointerup', handleDragEnd);
      window.addEventListener('pointercancel', handleDragEnd);
  }

  _updateMediaZoom() {
      const isExpanded = document.getElementById('media-wrapper').classList.contains('expanded');
      const contents = document.querySelectorAll('.media-content');
      
      contents.forEach(el => {
          if (!isExpanded) {
              el.style.width = ''; el.style.height = ''; 
              el.style.maxWidth = '100%'; el.style.maxHeight = '100%';
              el.style.transform = '';
              return;
          }
          el.style.transform = ''; 
          el.style.maxWidth = 'none'; 
          el.style.maxHeight = 'none';
          el.style.height = (this.mediaZoom * 100) + '%';
          el.style.width = 'auto'; 
      });
  }

  _bindProjectControls() {
      const btnSaveMenu = document.getElementById('btn-save-project-menu');
      const savePopup = document.getElementById('save-options-popup');
      const btnConfirmSave = document.getElementById('btn-confirm-save');
      const includeTutorialCheckbox = document.getElementById('include-tutorial-checkbox');
      const fileInput = document.getElementById('file-input-project');

      const btnNewMenu = document.getElementById('btn-new-menu');
      const newPopup = document.getElementById('new-options-popup');
      const btnNewProject = document.getElementById('btn-new-project');
      const btnLoadMenu = document.getElementById('btn-load-project-menu');

      btnSaveMenu.addEventListener('click', (e) => {
          e.stopPropagation();
          savePopup.style.display = savePopup.style.display === 'block' ? 'none' : 'block';
          newPopup.style.display = 'none'; 
      });

      btnNewMenu.addEventListener('click', (e) => {
          e.stopPropagation();
          newPopup.style.display = newPopup.style.display === 'block' ? 'none' : 'block';
          savePopup.style.display = 'none'; 
      });

      window.addEventListener('click', (e) => {
          if (!savePopup.contains(e.target) && e.target !== btnSaveMenu) {
              savePopup.style.display = 'none';
          }
          if (!newPopup.contains(e.target) && e.target !== btnNewMenu) {
              newPopup.style.display = 'none';
          }
      });

      btnConfirmSave.addEventListener('click', () => {
          savePopup.style.display = 'none';
          this.saveProject(includeTutorialCheckbox.checked);
      });

      btnLoadMenu.addEventListener('click', () => {
          newPopup.style.display = 'none';
          fileInput.click();
      });

      btnNewProject.addEventListener('click', () => {
          newPopup.style.display = 'none';
          if (confirm("Vuoi iniziare un nuovo progetto? Eventuali modifiche non salvate andranno perse.")) {
              this.shapes = [];
              this.redoShapes = [];
              this.tutorialLog = [];
              this.currentTutorialIndex = -1;
              this._preDemoShapes = null;
              this.ghostShapes = [];
              this.mediaList = [];
              this.currentMediaIndex = -1;
              this.currentPolygonPoints = [];
              this.selectedShapes = [];
              this.lineStart = null;
              this.isDrawingLine = false;
              this._resetArc(true);
              this._clearPreview();
              this.pauseTutorial();
              this.isRecording = false;

              document.getElementById('btn-tut-rec').innerHTML = '🔴 Rec';
              document.getElementById('btn-tut-rec').classList.remove('selected');
              const tutUndoBtn = document.getElementById('btn-tut-undo-rec');
              if (tutUndoBtn) tutUndoBtn.style.display = 'none';

              document.getElementById('titolo').value = '';
              document.getElementById('cognome').value = '';
              document.getElementById('nome').value = '';
              document.getElementById('classe').value = '';
              document.getElementById('data').value = (new Date()).toLocaleDateString('it-IT');

              this._updateMediaUI();
              this._updateTutorialStatus();
              this._redrawPermShapes();
              this._clearAutoSave();
              
              const tutGroup = document.getElementById('tutorial-toolbar-group');
              tutGroup.style.display = 'none';
              document.getElementById('btn-toggle-tutorial-menu').classList.remove('selected');
              
              this.arcStatusSpan.textContent = 'Nuovo progetto creato';
          }
      });

      fileInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;
          this.loadProject(file);
          e.target.value = ''; 
      });
  }

  saveProject(includeTutorial = true) {
      const projectData = {
          version: '1.0',
          timestamp: Date.now(),
          shapes: this.shapes,
          tutorialLog: includeTutorial ? this.tutorialLog : [], 
          settings: {
              cellSize: this.cellSizeCSS,
              isIsometric: this.isIsometric,
              isCartesian: this.isCartesian,
              cols: this.cols,
              rows: this.rows
          },
          metadata: {
              titolo: document.getElementById('titolo').value,
              cognome: document.getElementById('cognome').value,
              nome: document.getElementById('nome').value,
              classe: document.getElementById('classe').value,
              data: document.getElementById('data').value
          },
          mediaList: this.mediaList.map(m => {
              if(m.type === 'video' && m.src.startsWith('data:')) {
                  return null; 
              }
              return m;
          }).filter(m => m !== null) 
      };

      const jsonStr = JSON.stringify(projectData);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      const safeTitle = (projectData.metadata.titolo || 'progetto').replace(/[^a-z0-9]/gi, '_');
      link.download = `GridArt_${safeTitle}.sgp`; 
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      this._clearAutoSave();
  }

  _clearAutoSave() {
      localStorage.removeItem('gridArtPro_autosave');
  }

  loadProject(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const data = JSON.parse(e.target.result);
              if (!data.version || !data.shapes) throw new Error("Formato file non valido");

              if(data.metadata) {
                  document.getElementById('titolo').value = data.metadata.titolo || '';
                  document.getElementById('cognome').value = data.metadata.cognome || '';
                  document.getElementById('nome').value = data.metadata.nome || '';
                  document.getElementById('classe').value = data.metadata.classe || '';
                  document.getElementById('data').value = data.metadata.data || '';
              }

              if(data.settings) {
                  this.cellSizeCSS = data.settings.cellSize || 50;
                  this.isIsometric = data.settings.isIsometric || false;
                  this.isCartesian = data.settings.isCartesian || false;
                  this._updateGridModeButtons();
                  
                  const cmdPanel = document.getElementById('cartesian-console');
                  if (this.isCartesian) cmdPanel.style.display = 'flex';
                  else cmdPanel.style.display = 'none';
                  
                  this._createGrid(this.cellSizeCSS);
              }

              this.shapes = data.shapes || [];
              this.selectedShapes = [];
              
              this.tutorialLog = data.tutorialLog || [];
              // Vedi nota in autoload: il tutorial resta "Off" al caricamento del file,
              // così il disegno è subito modificabile; i passaggi restano comunque disponibili.
              this.currentTutorialIndex = -1;
              this.isRecording = false;
              this._preDemoShapes = null;
              
              if(this.tutorialLog.length > 0) {
                  const tutGroup = document.getElementById('tutorial-toolbar-group');
                  const btnMenu = document.getElementById('btn-toggle-tutorial-menu');
                  const rect = btnMenu.getBoundingClientRect();
                  tutGroup.style.display = 'flex';
                  if (!tutGroup.classList.contains('detached-panel')) {
                      tutGroup.style.top = (rect.bottom + 10) + 'px';
                      tutGroup.style.left = rect.left + 'px';
                  }
                  btnMenu.classList.add('selected');
              }
              
              document.getElementById('btn-tut-rec').innerHTML = '🔴 Rec';
              document.getElementById('btn-tut-rec').classList.remove('selected');
              const tutUndoBtn = document.getElementById('btn-tut-undo-rec');
              if (tutUndoBtn) tutUndoBtn.style.display = 'none';

              this._updateGhostShapes();
              this._updateTutorialStatus();

              this._redrawPermShapes();

              if(data.mediaList && Array.isArray(data.mediaList)) {
                  this.mediaList = data.mediaList;
                  this.currentMediaIndex = this.mediaList.length > 0 ? 0 : -1;
                  this._updateMediaUI();
              } else {
                  this.mediaList = [];
                  this.currentMediaIndex = -1;
                  this._updateMediaUI();
              }
              
              this._clearAutoSave(); 

              alert("Progetto caricato con successo!");

          } catch (err) {
              alert("Errore nel caricamento del file: " + err.message);
          }
      };
      reader.readAsText(file);
  }

  autoAdjustGrid() {
      if (!this.gridContainer || this.gridContainer.classList.contains('expanded-grid')) return;
      
      let cWidth = this.gridContainer.clientWidth;
      let cHeight = this.gridContainer.clientHeight;
      
      if (cWidth < 50) cWidth = window.innerWidth - 40;
      if (cHeight < 50) cHeight = 400;

      const availWidth = cWidth - 50; 
      const availHeight = cHeight - 50; 
      
      const sizeByWidth = availWidth / this.cols;
      const sizeByHeight = availHeight / this.rows;
      let newSize = Math.min(sizeByWidth, sizeByHeight);
      
      newSize = Math.min(newSize, CONFIG.maxCellSize);
      newSize = Math.max(newSize, CONFIG.minCellSize);
      newSize = Math.floor(newSize); 

      if (newSize !== this.cellSizeCSS) {
          this._createGrid(newSize);
      } else {
          this._resizeCanvases();
      }
  }

  _createGrid(size){
    if (this.cellSizeCSS > 0 && size !== this.cellSizeCSS) {
        const scaleFactor = size / this.cellSizeCSS;
        
        this.shapes.forEach(shape => this._scaleShape(shape, scaleFactor));

        if (this.tutorialLog && this.tutorialLog.length > 0) {
            this.tutorialLog.forEach(stepArray => {
                stepArray.forEach(shape => this._scaleShape(shape, scaleFactor));
            });
        }
        this._updateGhostShapes(); 

        if (this.currentPolygonPoints.length > 0) {
            this.currentPolygonPoints.forEach(p => {
                p.x *= scaleFactor;
                p.y *= scaleFactor;
            });
        }
    }

    this.cellSizeCSS = size; 
    
    document.documentElement.style.setProperty('--cell-size', `${size}px`);
    document.documentElement.style.setProperty('--grid-cols', `${this.cols}`);
    document.documentElement.style.setProperty('--grid-rows', `${this.rows}`);
    
    this.grid.style.width = (size * this.cols) + 'px';
    this.grid.style.height = (size * this.rows) + 'px';
    
    this.coordTop.innerHTML = '';
    this.coordLeft.innerHTML = '';
    
    if (this.isCartesian) {
        this.coordTop.style.display = 'block';
        this.coordLeft.style.display = 'block';

        const midX = Math.floor(this.cols / 2);
        const midY = Math.floor(this.rows / 2);

        for (let i = 0; i <= this.cols; i++) {
            const label = document.createElement('div');
            label.className = 'coordinate-label cartesian-abs';
            label.textContent = i - midX;
            label.style.left = (i * size) + 'px';
            this.coordTop.appendChild(label);
        }

        for (let i = 0; i <= this.rows; i++) {
            const val = midY - i;
            if (val === 0) continue; 
            const label = document.createElement('div');
            label.className = 'coordinate-label cartesian-abs';
            label.textContent = val;
            label.style.top = (i * size) + 'px';
            this.coordLeft.appendChild(label);
        }
    } else {
        this.coordTop.style.display = 'grid';
        this.coordLeft.style.display = 'grid';

        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, this.cols).split(''); 
        const numbers = Array.from({length: this.rows}, (_, i) => i + 1); 
        
        letters.forEach(letter => {
            const label = document.createElement('div');
            label.className = 'coordinate-label';
            label.textContent = letter;
            this.coordTop.appendChild(label);
        });
        numbers.reverse().forEach(number => {
            const label = document.createElement('div');
            label.className = 'coordinate-label';
            label.textContent = number;
            this.coordLeft.appendChild(label);
        });
    }

    const cells = this.grid.querySelectorAll('.cell');
    cells.forEach(c => c.remove());

    const total = this.cols * this.rows;
    for (let i=0;i<total;i++){
      const cell = document.createElement('div');
      cell.className = 'cell';
      this.grid.appendChild(cell);
    }
    
    this.permCanvas = document.getElementById('line-perm');
    this.previewCanvas = document.getElementById('line-preview');

    this._setupCanvases();
    this._redrawPermShapes();
    this._toggleGridVisuals();
  }

  _scaleShape(shape, scaleFactor) {
      if (shape.x !== undefined) shape.x *= scaleFactor;
      if (shape.y !== undefined) shape.y *= scaleFactor;
      if (shape.x1 !== undefined) shape.x1 *= scaleFactor;
      if (shape.y1 !== undefined) shape.y1 *= scaleFactor;
      if (shape.x2 !== undefined) shape.x2 *= scaleFactor;
      if (shape.y2 !== undefined) shape.y2 *= scaleFactor;
      if (shape.cx !== undefined) shape.cx *= scaleFactor;
      if (shape.cy !== undefined) shape.cy *= scaleFactor;
      if (shape.r !== undefined) shape.r *= scaleFactor;
      if (shape.type === 'label' && shape.size) shape.size *= scaleFactor;

      if (shape.points) {
          shape.points.forEach(p => {
              p.x *= scaleFactor;
              p.y *= scaleFactor;
          });
      }
  }

  _setupCanvases(){
    const cssW = this.grid.offsetWidth;
    const cssH = this.grid.offsetHeight;
    const dpr = window.devicePixelRatio || 1;
    if (cssW === 0 || cssH === 0) return;

    [this.gridBgCanvas, this.permCanvas, this.previewCanvas].forEach(canvas => {
        canvas.style.left = '0px'; canvas.style.top = '0px';
        canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr,0,0,dpr,0,0);
        ctx.clearRect(0,0,cssW,cssH);
    });

    this.gridBgCtx = this.gridBgCanvas.getContext('2d');
    this.permCtx = this.permCanvas.getContext('2d');
    this.previewCtx = this.previewCanvas.getContext('2d');
    
    this._toggleGridVisuals(); 
  }

  _resizeCanvases(){
      this._setupCanvases();
      this._redrawPermShapes();
  }

  _initPalette(){
    this.palette.innerHTML = '';
    
    CONFIG.COLORS.forEach((c, idx) => {
      const b = document.createElement('button');
      b.className='color';
      b.style.background = c.hex;
      b.setAttribute('role','radio');
      b.title = c.name;
      b.addEventListener('click', ()=>{
        document.querySelectorAll('.color').forEach(x=>x.classList.remove('selected'));
        b.classList.add('selected');
        this.selectedColor = c;
        this._updateSelectedShapesProperty('color', this.selectedColor.hex); 
      });
      this.palette.appendChild(b);
    });

    const customWrapper = document.createElement('div');
    customWrapper.className = 'custom-color-wrapper';

    const customBtn = document.createElement('button');
    customBtn.className = 'color';
    customBtn.title = "Colore Personalizzato (Scegli e Sostituisci)";
    customBtn.innerHTML = '🎨'; 
    customBtn.style.display = 'flex';
    customBtn.style.alignItems = 'center';
    customBtn.style.justifyContent = 'center';
    customBtn.style.fontSize = '12px';
    customBtn.style.background = '#ffffff'; 
    customBtn.style.position = 'relative'; 
    customBtn.style.overflow = 'hidden';

    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'color';
    
    hiddenInput.style.position = 'absolute';
    hiddenInput.style.top = '0';
    hiddenInput.style.left = '0';
    hiddenInput.style.width = '100%';
    hiddenInput.style.height = '100%';
    hiddenInput.style.opacity = '0'; 
    hiddenInput.style.cursor = 'pointer';

    hiddenInput.addEventListener('input', (e) => {
        const hex = e.target.value;
        this.customColorHex = hex; 
        
        customBtn.style.background = hex;
        customBtn.innerHTML = ''; 
        
        document.querySelectorAll('.color').forEach(x=>x.classList.remove('selected'));
        customBtn.classList.add('selected');
        
        this.selectedColor = { name: 'Custom', hex: hex };
        this._updateSelectedShapesProperty('color', hex);
    });

    customBtn.appendChild(hiddenInput); 
    customWrapper.appendChild(customBtn);
    this.palette.appendChild(customWrapper);
  }

  _bindTools(){
    document.querySelector('.main-toolbar').addEventListener('scroll', () => {
        document.getElementById('arc-options-popup').style.display = 'none';
    });

    this.toolButtons.forEach(btn=>{
      if(btn.id === 'btn-copy' || btn.id === 'btn-paste' || btn.id === 'btn-save-jpg') return;

      btn.addEventListener('click', ()=>{
        const newTool = btn.id.replace('tool-','');
        this.toolButtons.forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');

        this.lineStart = null;
        this.isDrawingLine = false;
        this.currentPolygonPoints = []; 
        
        this.dimStart = null;
        this.dimCenter = null;
        this.dimState = 1;

        this._resetArc(); 
        this._clearPreview();
        this._hideTooltip();
        // Passando allo strumento Sposta manteniamo la selezione multipla attiva
        // (fatta con "Seleziona", shift-click o dal pannello Filtra) così può essere
        // spostata in blocco. Per tutti gli altri strumenti si azzera come prima.
        if (newTool !== 'move') {
            this.selectedShapes = []; 
        }
        this._redrawPermShapes(); 
        
        this.moveState = { isMoving: false, shape: null, shapes: null, startPoint: null };

        this._setTool(newTool);
        
        const arcPopup = document.getElementById('arc-options-popup');
        if (newTool === 'arc' || newTool === 'arc-fill' || newTool === 'dim-ang') {
            arcPopup.style.display = 'block';
            const rect = btn.getBoundingClientRect();
            arcPopup.style.top = (rect.bottom + 8) + 'px';
            arcPopup.style.left = rect.left + 'px';
        } else {
            arcPopup.style.display = 'none';
        }

        if (newTool === 'select') this.arcStatusSpan.textContent = 'Seleziona';
        else if (newTool === 'erase') this.arcStatusSpan.textContent = 'Cancella';
        else if (newTool === 'move') {
            this.arcStatusSpan.textContent = this.selectedShapes.length > 0
                ? `Sposta Gruppo (${this.selectedShapes.length}): Clicca punto di partenza`
                : 'Sposta: Seleziona oggetto';
        }
        else if (newTool === 'label') this.arcStatusSpan.textContent = 'Posiziona Etichetta';
        else if (['arc','arc-fill','circle'].includes(newTool)) this.arcStatusSpan.textContent = 'Centro';
        else if (newTool === 'line') this.arcStatusSpan.textContent = 'Inizio Linea';
        else if (newTool === 'polygon-border') this.arcStatusSpan.textContent = 'Primo Vertice';
        else if (newTool === 'bucket') this.arcStatusSpan.textContent = 'Riempi';
        else if (newTool === 'dim-line') this.arcStatusSpan.textContent = 'Quota Lineare: Inizio';
        else if (newTool === 'dim-rad') this.arcStatusSpan.textContent = 'Quota Raggio: Centro';
        else if (newTool === 'dim-ang') this.arcStatusSpan.textContent = 'Quota Angolo: Centro';
        else this.arcStatusSpan.textContent = '';
        
        this.eraseSelectedBtn.style.display = 'none';
      });
    });
    
    this.eraseSelectedBtn.addEventListener('click', () => this._eraseSelectedShapes());
    document.getElementById('btn-copy').addEventListener('click', () => this.copySelection());
    document.getElementById('btn-paste').addEventListener('click', () => this.pasteSelection());
  }

  _bindStrokeControls() {
      this.strokeWidthButtons.forEach(btn => {
          btn.addEventListener('click', () => {
              const newWidth = parseInt(btn.dataset.width);
              this.strokeWidth = newWidth;
              this.strokeWidthButtons.forEach(b => b.classList.remove('selected'));
              btn.classList.add('selected');
              this._updateSelectedShapesProperty('width', newWidth);
              this._updateSelectedShapesProperty('size', newWidth * 4); 
          });
      });

      this.toggleDashedCheckbox.addEventListener('change', (e) => {
          this.isDashed = e.target.checked;
          this._updateSelectedShapesProperty('dashed', this.isDashed);
      });

      this.toggleCounterClockwiseCheckbox.addEventListener('change', (e) => {
          this.isCounterClockwise = e.target.checked;
          if ((this.tool === 'arc' || this.tool === 'arc-fill') && this.arcState === 3) {
              this._clearPreview();
          }
      });
      
      this.toggleArrowStart.addEventListener('change', (e) => {
          this.isArrowStart = e.target.checked;
      });
      this.toggleArrowEnd.addEventListener('change', (e) => {
          this.isArrowEnd = e.target.checked;
      });
  }

  _updateSelectedShapesProperty(prop, value) {
      if (this.selectedShapes.length === 0) return;
      this.selectedShapes.forEach(index => {
          if (this.shapes[index]) this.shapes[index][prop] = value;
      });
      this._saveStateForTutorial();
      this._redrawPermShapes();
  }
  
  _resetArc(clear=false){
      this.arcState = 1;
      this.centerPoint = null;
      this.radius = 0;
      this.startAngle = 0;
      this.arcStatusSpan.textContent = 'Centro';
      this._hideTooltip(); 
      if (clear) this._clearPreview();
  }
  
  _handleArcClick(snap){
      const currentTool = this.tool;
      if (currentTool !== 'arc' && currentTool !== 'arc-fill' && currentTool !== 'circle') return;
      
      switch(this.arcState) {
          case 1:
              this.centerPoint = { x: snap.x, y: snap.y };
              this.arcState = 2;
              this.arcStatusSpan.textContent = 'Raggio';
              break;
          case 2:
              const dx = snap.x - this.centerPoint.x;
              const dy = snap.y - this.centerPoint.y;
              this.radius = Math.sqrt(dx * dx + dy * dy);
              if (this.radius < this.TOLERANCE) {
                  this.centerPoint = null; this.arcState = 1;
                  this.arcStatusSpan.textContent = 'Riprova (Raggio 0)';
                  return;
              }
              if (currentTool === 'circle') {
                  this.shapes.push({
                      type: 'arc', cx: this.centerPoint.x, cy: this.centerPoint.y,
                      r: this.radius, start: 0, end: Math.PI * 2, counterClockwise: false,
                      color: this.selectedColor.hex, width: this.strokeWidth, filled: false, dashed: this.isDashed
                  });
                  this.redoShapes = []; 
                  this._saveStateForTutorial();
                  this._redrawPermShapes();
                  this._resetArc(true);
              } else {
                  this.startAngle = Math.atan2(dy, dx);
                  this.arcState = 3;
                  this.arcStatusSpan.textContent = 'Fine (Angolo)';
                  document.getElementById('measure-input').blur(); 
              }
              break;
          case 3:
              const endDx = snap.x - this.centerPoint.x;
              const endDy = snap.y - this.centerPoint.y;
              const endAngle = Math.atan2(endDy, endDx);
              this.shapes.push({
                  type: 'arc', cx: this.centerPoint.x, cy: this.centerPoint.y,
                  r: this.radius, start: this.startAngle, end: endAngle, counterClockwise: this.isCounterClockwise,
                  color: this.selectedColor.hex, width: this.strokeWidth, filled: (currentTool === 'arc-fill'), dashed: this.isDashed
              });
              this.redoShapes = []; 
              this._saveStateForTutorial();
              this._redrawPermShapes();
              this._resetArc(true);
              break;
      }
  }
  
  _handleLabelClick(snap) {
      this.pendingLabelSnap = snap;
      const modal = document.getElementById('text-prompt-modal');
      const input = document.getElementById('modal-text-input');
      const checkBold = document.getElementById('modal-bold-checkbox');
      const checkPoint = document.getElementById('modal-point-checkbox');
      const checkSideLeft = document.getElementById('modal-side-left-checkbox');
      const checkSideRight = document.getElementById('modal-side-right-checkbox');
      
      input.value = "A";
      checkBold.checked = this.isBold; 
      if (checkPoint) checkPoint.checked = false;
      if (checkSideLeft) checkSideLeft.checked = false;
      if (checkSideRight) checkSideRight.checked = true;
      modal.style.display = 'flex';
      input.focus();
      input.select();
  }

  _handleDimLineClick(snap, ev) {
      if (!this.dimStart) {
          this.dimStart = { x: snap.x, y: snap.y };
          this.arcStatusSpan.textContent = 'Quota Linea: Fine';
      } else {
          let finalX = snap.x;
          let finalY = snap.y;

          const angleSnapToggle = document.getElementById('toggle-angle-snap');
          if (ev && (ev.shiftKey || (angleSnapToggle && angleSnapToggle.checked))) {
              let dx = finalX - this.dimStart.x;
              let dy = finalY - this.dimStart.y;
              let distPx = Math.sqrt(dx * dx + dy * dy);
              let mathAngle = Math.atan2(-dy, dx);
              const step = Math.PI / 12; 
              mathAngle = Math.round(mathAngle / step) * step;
              finalX = this.dimStart.x + distPx * Math.cos(mathAngle);
              finalY = this.dimStart.y - distPx * Math.sin(mathAngle);
          }

          const dx = finalX - this.dimStart.x;
          const dy = finalY - this.dimStart.y;
          const distPx = Math.sqrt(dx * dx + dy * dy);
          const distUnits = (distPx / this.cellSizeCSS).toFixed(1);

          this.shapes.push({
              type: 'line', x1: this.dimStart.x, y1: this.dimStart.y, x2: finalX, y2: finalY,
              color: this.selectedColor.hex, width: 1, dashed: false,
              arrowStart: true, arrowEnd: true
          });

          this.shapes.push({
              type: 'label', x: this.dimStart.x + dx / 2, y: this.dimStart.y + dy / 2 - 8,
              text: distUnits, color: this.selectedColor.hex, size: 12, font: 'Inter, sans-serif',
              isBold: this.isBold 
          });

          this.redoShapes = [];
          this._saveStateForTutorial();
          this._redrawPermShapes();
          this.dimStart = null;
          this._clearPreview();
          this._hideTooltip();
          this.arcStatusSpan.textContent = 'Quota Lineare: Inizio';
      }
  }

  _handleDimRadClick(snap) {
      if (!this.dimCenter) {
          this.dimCenter = { x: snap.x, y: snap.y };
          this.arcStatusSpan.textContent = 'Quota Raggio: Bordo';
      } else {
          const dx = snap.x - this.dimCenter.x;
          const dy = snap.y - this.dimCenter.y;
          const distPx = Math.sqrt(dx * dx + dy * dy);
          const distUnits = (distPx / this.cellSizeCSS).toFixed(1);

          this.shapes.push({
              type: 'line', x1: this.dimCenter.x, y1: this.dimCenter.y, x2: snap.x, y2: snap.y,
              color: this.selectedColor.hex, width: 1, dashed: false,
              arrowStart: false, arrowEnd: true
          });

          this.shapes.push({
              type: 'label', x: this.dimCenter.x + dx / 2, y: this.dimCenter.y + dy / 2 - 8,
              text: 'R: ' + distUnits, color: this.selectedColor.hex, size: 12, font: 'Inter, sans-serif',
              isBold: this.isBold
          });

          this.redoShapes = [];
          this._saveStateForTutorial();
          this._redrawPermShapes();
          this.dimCenter = null;
          this._clearPreview();
          this._hideTooltip();
          this.arcStatusSpan.textContent = 'Quota Raggio: Centro';
      }
  }

  _handleDimAngClick(snap) {
      if (this.dimState === 1) {
          this.dimCenter = { x: snap.x, y: snap.y };
          this.dimState = 2;
          this.arcStatusSpan.textContent = 'Quota Angolo: 1° Lato';
      } else if (this.dimState === 2) {
          const dx = snap.x - this.dimCenter.x;
          const dy = snap.y - this.dimCenter.y;
          this.dimRadius = Math.sqrt(dx * dx + dy * dy);
          if(this.dimRadius < this.TOLERANCE) return;
          this.dimStartAngle = Math.atan2(dy, dx);
          this.dimState = 3;
          this.arcStatusSpan.textContent = 'Quota Angolo: 2° Lato';
      } else if (this.dimState === 3) {
          const dx = snap.x - this.dimCenter.x;
          const dy = snap.y - this.dimCenter.y;
          const currentEnd = Math.atan2(dy, dx);

          let diff = currentEnd - this.dimStartAngle;
          if (this.isCounterClockwise) {
              if (diff > 0) diff -= 2 * Math.PI;
          } else {
              if (diff < 0) diff += 2 * Math.PI;
          }
          let deg = Math.abs((diff * 180) / Math.PI).toFixed(1);

          this.shapes.push({
              type: 'arc', cx: this.dimCenter.x, cy: this.dimCenter.y,
              r: this.dimRadius, start: this.dimStartAngle, end: currentEnd, counterClockwise: this.isCounterClockwise,
              color: this.selectedColor.hex, width: 1, filled: false, dashed: true
          });

          let midAngle = this.dimStartAngle + diff / 2;
          const labelR = this.dimRadius + 15;
          const lx = this.dimCenter.x + labelR * Math.cos(midAngle);
          const ly = this.dimCenter.y + labelR * Math.sin(midAngle);

          this.shapes.push({
              type: 'label', x: lx, y: ly,
              text: deg + '°', color: this.selectedColor.hex, size: 12, font: 'Inter, sans-serif',
              isBold: this.isBold
          });

          this.redoShapes = [];
          this._saveStateForTutorial();
          this._redrawPermShapes();
          this.dimState = 1;
          this.dimCenter = null;
          this._clearPreview();
          this._hideTooltip();
          this.arcStatusSpan.textContent = 'Quota Angolo: Centro';
      }
  }


  _bindGridControls(){
    document.getElementById('toggle-grid').addEventListener('click', (e)=>{
      this.isGridVisible = !this.isGridVisible;
      e.currentTarget.textContent = this.isGridVisible ? '👁️' : '🚫';
      this._toggleGridVisuals();
    });

    this.toggleIsoBtn.addEventListener('click', () => {
        this.isIsometric = !this.isIsometric;
        if (this.isIsometric) this.isCartesian = false; 
        
        const cmdPanel = document.getElementById('cartesian-console');
        cmdPanel.style.display = 'none';

        this._updateGridModeButtons();
        this._createGrid(this.cellSizeCSS);
        this._toggleGridVisuals();
    });

    this.toggleCartesianBtn.addEventListener('click', () => {
        this.isCartesian = !this.isCartesian;
        if (this.isCartesian) this.isIsometric = false; 
        
        const cmdPanel = document.getElementById('cartesian-console');
        if (this.isCartesian) {
            cmdPanel.style.display = 'flex';
        } else {
            cmdPanel.style.display = 'none';
        }

        this._updateGridModeButtons();
        this._createGrid(this.cellSizeCSS);
        this._toggleGridVisuals();
    });

    this.toggleSubGridCheckbox.addEventListener('change', (e) => {
        this.isSubGridVisible = e.target.checked;
        this._toggleGridVisuals();
    });
  }

  _updateGridModeButtons() {
      if (this.isIsometric) {
          this.toggleIsoBtn.innerHTML = '📐 Isometrica';
          this.toggleIsoBtn.title = 'Passa a Standard';
          this.toggleIsoBtn.style.background = 'var(--accent)';
          this.toggleIsoBtn.style.color = 'white';
      } else {
          this.toggleIsoBtn.innerHTML = '🔳 Standard';
          this.toggleIsoBtn.title = 'Passa a Isometrica';
          this.toggleIsoBtn.style.background = '';
          this.toggleIsoBtn.style.color = '';
      }

      if (this.isCartesian) {
          this.toggleCartesianBtn.style.background = 'var(--accent)';
          this.toggleCartesianBtn.style.color = 'white';
      } else {
          this.toggleCartesianBtn.style.background = '';
          this.toggleCartesianBtn.style.color = '';
      }
  }

  _toggleGridVisuals() {
      if (!this.gridBgCtx) return;
      const cssW = this.grid.offsetWidth;
      const cssH = this.grid.offsetHeight;
      this.gridBgCtx.clearRect(0,0,cssW,cssH);
      
      const cTop = document.getElementById('coord-top');
      const cLeft = document.getElementById('coord-left');

      if (!this.isGridVisible) {
          document.querySelectorAll('.cell').forEach(c => c.style.border = 'none');
          if(cTop) cTop.style.display = 'none';
          if(cLeft) cLeft.style.display = 'none';
          return;
      }

      if(cTop) cTop.style.display = this.isCartesian ? 'block' : 'grid';
      if(cLeft) cLeft.style.display = this.isCartesian ? 'block' : 'grid';

      if (this.isIsometric) {
          document.querySelectorAll('.cell').forEach(c => c.style.border = 'none');
          if (this.isSubGridVisible) {
              this._drawIsometricGridLayer(this.cellSizeCSS / 2, '#e2e8f0');
          }
          this._drawIsometricGridLayer(this.cellSizeCSS, '#cbd5e1');
      } else {
          document.querySelectorAll('.cell').forEach(c => c.style.border = '1px solid var(--cell-border)');
          if (this.isSubGridVisible) {
              this._drawOrthogonalSubGrid();
          }
      }

      if (this.isCartesian && this.isGridVisible) {
          const midX = Math.floor(this.cols / 2) * this.cellSizeCSS;
          const midY = Math.floor(this.rows / 2) * this.cellSizeCSS;
          
          this.gridBgCtx.save();
          this.gridBgCtx.strokeStyle = '#0f172a';
          this.gridBgCtx.lineWidth = 2;
          
          this.gridBgCtx.beginPath();
          this.gridBgCtx.moveTo(0, midY);
          this.gridBgCtx.lineTo(cssW, midY);
          this.gridBgCtx.stroke();
          
          this.gridBgCtx.beginPath();
          this.gridBgCtx.moveTo(cssW - 8, midY - 4);
          this.gridBgCtx.lineTo(cssW, midY);
          this.gridBgCtx.lineTo(cssW - 8, midY + 4);
          this.gridBgCtx.stroke();
          
          this.gridBgCtx.beginPath();
          this.gridBgCtx.moveTo(midX, cssH);
          this.gridBgCtx.lineTo(midX, 0);
          this.gridBgCtx.stroke();
          
          this.gridBgCtx.beginPath();
          this.gridBgCtx.moveTo(midX - 4, 8);
          this.gridBgCtx.lineTo(midX, 0);
          this.gridBgCtx.lineTo(midX + 4, 8);
          this.gridBgCtx.stroke();
          
          this.gridBgCtx.restore();
      }
  }
  
  _drawOrthogonalSubGrid() {
      const ctx = this.gridBgCtx;
      const w = this.grid.offsetWidth;
      const h = this.grid.offsetHeight;
      const step = this.cellSizeCSS;
      const halfStep = step / 2;

      ctx.save();
      ctx.strokeStyle = '#e2e8f0'; 
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      for (let x = halfStep; x < w; x += step) {
          ctx.moveTo(x, 0); ctx.lineTo(x, h);
      }
      for (let y = halfStep; y < h; y += step) {
          ctx.moveTo(0, y); ctx.lineTo(w, y);
      }

      ctx.stroke();
      ctx.restore();
  }

  _drawIsometricGridLayer(size, color) {
      const ctx = this.gridBgCtx;
      const w = this.grid.offsetWidth;
      const h = this.grid.offsetHeight;

      ctx.save();
      ctx.strokeStyle = color; 
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      const W_STEP = size * Math.cos(Math.PI / 6); 
      const H_HALF_STEP = size * Math.sin(Math.PI / 6); 
      const H_FULL_STEP = H_HALF_STEP * 2; 

      const numCols = Math.ceil(w / W_STEP) + 2; 
      const numRows = Math.ceil(h / H_FULL_STEP) + 2; 

      for (let c = -1; c <= numCols; c++) {
          const x = c * W_STEP; 
          const yOffset = (c % 2 !== 0) ? H_HALF_STEP : 0; 
          for (let r = -1; r <= numRows; r++) {
              const y = r * H_FULL_STEP + yOffset; 
              ctx.moveTo(x, y - H_HALF_STEP); ctx.lineTo(x, y + H_HALF_STEP);
              ctx.moveTo(x, y); ctx.lineTo(x + W_STEP, y + H_HALF_STEP);
              ctx.moveTo(x, y); ctx.lineTo(x + W_STEP, y - H_HALF_STEP);
          }
      }
      ctx.stroke();
      ctx.restore();
  }
  
  _bindMediaControls(){
    const fileInput = document.getElementById('image-file-input');
    const uploadBtn = document.getElementById('upload-image-btn');
    const urlInput = document.getElementById('external-url-input');
    const loadUrlBtn = document.getElementById('load-url-btn');
    const openExtBtn = document.getElementById('open-external-btn');
    const addMediaBtn = document.getElementById('btn-add-media'); 
    const expandBtn = document.getElementById('toggle-expand-btn');
    const closeBtn = document.getElementById('close-media-expanded-btn'); 
    const wrapper = document.getElementById('media-wrapper');
    
    const btnPrev = document.getElementById('btn-prev-media');
    const btnNext = document.getElementById('btn-next-media');
    const btnDel = document.getElementById('btn-delete-media');

    uploadBtn.addEventListener('click', ()=> fileInput.click());
    fileInput.addEventListener('change', (e)=>{
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      
      files.forEach(file => {
          const isVideo = file.type.startsWith('video');
          const reader = new FileReader();
          reader.onload = (ev) => {
             this._addMedia(ev.target.result, isVideo ? 'video' : 'image', file.name);
          };
          reader.readAsDataURL(file);
      });
      fileInput.value = '';
    });

    loadUrlBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if(!url) return;
        this._parseAndLoadUrl(url);
        urlInput.value = ''; 
    });

    urlInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') loadUrlBtn.click();
    });

    openExtBtn.addEventListener('click', () => {
        const curr = this.mediaList[this.currentMediaIndex];
        if(curr && curr.src.startsWith('http')) window.open(curr.src, '_blank');
    });

    addMediaBtn.addEventListener('click', () => {
        fileInput.click();
    });

    btnPrev.addEventListener('click', () => {
        if (this.currentMediaIndex > 0) {
            this.currentMediaIndex--;
            this._updateMediaUI();
        }
    });
    
    btnNext.addEventListener('click', () => {
        if (this.currentMediaIndex < this.mediaList.length - 1) {
            this.currentMediaIndex++;
            this._updateMediaUI();
        }
    });

    btnDel.addEventListener('click', () => {
        if (this.currentMediaIndex > -1) {
            this.mediaList.splice(this.currentMediaIndex, 1);
            if (this.currentMediaIndex >= this.mediaList.length) {
                this.currentMediaIndex = this.mediaList.length - 1;
            }
            this._updateMediaUI();
        }
    });
  }

  _addMedia(src, type, name) {
      this.mediaList.push({ src, type, name });
      this.currentMediaIndex = this.mediaList.length - 1; 
      this._updateMediaUI();
  }

  _parseAndLoadUrl(url) {
      url = url.trim();
      const ytRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const ytMatch = url.match(ytRegExp);

      if (ytMatch && ytMatch[2].length === 11) {
          const embedUrl = `https://www.youtube-nocookie.com/embed/${ytMatch[2]}?rel=0&modestbranding=1`;
          this._addMedia(embedUrl, 'iframe', 'YouTube Video');
          return;
      }
      if (url.match(/\.(mp4|webm|ogg)$/i)) {
          this._addMedia(url, 'video', 'Video URL');
          return;
      }
      this._addMedia(url, 'image', 'Image URL');
  }

  _updateMediaUI() {
      const img = document.getElementById('uploaded-image');
      const vid = document.getElementById('video-element');
      const iframe = document.getElementById('iframe-element');
      const placeholder = document.querySelector('.upload-placeholder');
      const openExtBtn = document.getElementById('open-external-btn');
      const addMediaBtn = document.getElementById('btn-add-media');
      
      const galleryControls = document.getElementById('gallery-controls');
      const galleryCounter = document.getElementById('gallery-counter');
      const btnPrev = document.getElementById('btn-prev-media');
      const btnNext = document.getElementById('btn-next-media');

      img.style.display = 'none';
      vid.style.display = 'none';
      iframe.style.display = 'none';
      vid.pause();
      iframe.src = ""; 

      if (this.mediaList.length === 0) {
          placeholder.style.display = 'block';
          galleryControls.style.display = 'none';
          openExtBtn.style.display = 'none';
          addMediaBtn.style.display = 'none'; 
          return;
      }

      placeholder.style.display = 'none';
      galleryControls.style.display = 'flex';
      addMediaBtn.style.display = 'inline-block'; 

      btnPrev.disabled = (this.currentMediaIndex <= 0);
      btnNext.disabled = (this.currentMediaIndex >= this.mediaList.length - 1);
      galleryCounter.textContent = `${this.currentMediaIndex + 1}/${this.mediaList.length}`;

      const curr = this.mediaList[this.currentMediaIndex];
      
      if (curr.type === 'image') {
          img.src = curr.src;
          img.style.display = 'block';
      } else if (curr.type === 'video') {
          vid.src = curr.src;
          vid.style.display = 'block';
      } else if (curr.type === 'iframe') {
          iframe.src = curr.src;
          iframe.style.display = 'block';
      }
      
      if (curr.src.startsWith('http') && !curr.src.startsWith('data:')) {
          openExtBtn.style.display = 'inline-block';
      } else {
          openExtBtn.style.display = 'none';
      }
      
      this.mediaZoom = 1.0;
      this._updateMediaZoom();
  }

  _bindPrintControl(){
    document.getElementById('print-pdf').addEventListener('click', ()=>{
      this._exportGridToPDF();
    });
  }

  _bindSaveImageControl() {
      const btn = document.getElementById('btn-save-jpg');
      if (btn) {
          btn.addEventListener('click', () => {
              this._exportGridToJPG();
          });
      }
  }

  _exportGridToJPG() {
      const elementToCapture = document.querySelector('.grid-wrapper');
      const originalBg = elementToCapture.style.backgroundColor;
      elementToCapture.style.backgroundColor = 'white'; 
      const titolo = document.getElementById('titolo').value || 'disegno';
      const safeTitle = titolo.replace(/[^a-z0-9]/gi, '_');
      const filename = `GridArt_${safeTitle}_${Date.now()}.jpg`;

      html2canvas(elementToCapture, {
          scale: 2, 
          logging: false,
          useCORS: true,
          ignoreElements: (element) => element.id === 'line-preview' 
      }).then(canvas => {
          elementToCapture.style.backgroundColor = originalBg;
          const link = document.createElement('a');
          link.download = filename;
          link.href = canvas.toDataURL('image/jpeg', 0.9); 
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      }).catch(err => {
          elementToCapture.style.backgroundColor = originalBg;
          alert("Errore durante il salvataggio dell'immagine: " + err.message);
      });
  }

  _bindUndoClear(){
    document.getElementById('undo-line').addEventListener('click', ()=>{
        if (this.tool === 'polygon-border') {
            if (this.currentPolygonPoints.length > 0) {
                this.currentPolygonPoints.pop();
                this._redrawPolygonPreview();
            } else if (this.shapes.length > 0) {
                const shape = this.shapes.pop();
                this.redoShapes.push(shape); 
                this._saveStateForTutorial();
                this._redrawPermShapes();
            }
        } else {
            if (this.shapes.length > 0) {
                const shape = this.shapes.pop();
                this.redoShapes.push(shape); 
                this._saveStateForTutorial();
                this._redrawPermShapes();
            }
        }
        this.selectedShapes = [];
        this.eraseSelectedBtn.style.display = 'none';
    });

    document.getElementById('redo-line').addEventListener('click', ()=>{
        if (this.redoShapes.length > 0) {
            const shape = this.redoShapes.pop();
            this.shapes.push(shape);
            this._saveStateForTutorial();
            this._redrawPermShapes();
        }
    });

    document.getElementById('clear-lines').addEventListener('click', ()=>{
      if(confirm("Sei sicuro di voler cancellare tutto?")) {
          this.shapes = [];
          this.redoShapes = [];
          this.currentPolygonPoints = [];
          this.selectedShapes = []; 
          this._saveStateForTutorial();
          this._redrawPermShapes();
          this._clearPreview();
          this.eraseSelectedBtn.style.display = 'none';
          this.arcStatusSpan.textContent = '';
      }
    });
  }

  _getDistance(p1, p2) {
      return Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }

  _segmentIntersection(p1, p2, p3, p4) {
      const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
      if (Math.abs(d) < 1e-6) return null;
      const u = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
      const v = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
      if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
          return { x: p1.x + u * (p2.x - p1.x), y: p1.y + u * (p2.y - p1.y) };
      }
      return null;
  }

  _discretizeShapesForFill() {
      let segments = [];
      this.shapes.forEach(shape => {
          if (shape.type === 'line') {
              segments.push({ p1: {x: shape.x1, y: shape.y1}, p2: {x: shape.x2, y: shape.y2} });
          } else if (shape.type === 'polygon') {
              for (let i = 0; i < shape.points.length; i++) {
                  segments.push({ p1: shape.points[i], p2: shape.points[(i+1)%shape.points.length] });
              }
          } else if (shape.type === 'arc') {
              let start = shape.start;
              let end = shape.end;
              if (shape.counterClockwise) {
                  let temp = start; start = end; end = temp;
              }
              while(end < start) end += Math.PI * 2;
              
              const steps = Math.max(12, Math.ceil((end - start) / (Math.PI / 18))); 
              let prevPt = { x: shape.cx + shape.r * Math.cos(start), y: shape.cy + shape.r * Math.sin(start) };
              for (let i = 1; i <= steps; i++) {
                  const angle = start + (end - start) * (i / steps);
                  const pt = { x: shape.cx + shape.r * Math.cos(angle), y: shape.cy + shape.r * Math.sin(angle) };
                  segments.push({ p1: prevPt, p2: pt });
                  prevPt = pt;
              }
          }
      });
      const w = this.grid.offsetWidth;
      const h = this.grid.offsetHeight;
      segments.push({p1:{x:0,y:0}, p2:{x:w,y:0}});
      segments.push({p1:{x:w,y:0}, p2:{x:w,y:h}});
      segments.push({p1:{x:w,y:h}, p2:{x:0,y:h}});
      segments.push({p1:{x:0,y:h}, p2:{x:0,y:0}});
      
      return segments;
  }

  _buildPlanarGraph() {
      let segments = this._discretizeShapesForFill();
      let points = [];
      const TOL = 1.0; 

      const addPoint = (pt) => {
          let found = points.find(p => this._getDistance(p, pt) < TOL);
          if (!found) { found = {x: pt.x, y: pt.y, id: points.length}; points.push(found); }
          return found;
      };

      let splitSegments = [];
      for (let i = 0; i < segments.length; i++) {
          let segIntersections = [];
          for (let j = 0; j < segments.length; j++) {
              if (i === j) continue;
              let intPt = this._segmentIntersection(segments[i].p1, segments[i].p2, segments[j].p1, segments[j].p2);
              if (intPt) segIntersections.push(intPt);
          }
          segIntersections.sort((a, b) => this._getDistance(segments[i].p1, a) - this._getDistance(segments[i].p1, b));
          
          let currP = segments[i].p1;
          for (let pt of segIntersections) {
              if (this._getDistance(currP, pt) > TOL) {
                  splitSegments.push({p1: currP, p2: pt});
                  currP = pt;
              }
          }
          if (this._getDistance(currP, segments[i].p2) > TOL) {
              splitSegments.push({p1: currP, p2: segments[i].p2});
          }
      }

      let graph = new Map(); 
      splitSegments.forEach(seg => {
          let p1 = addPoint(seg.p1);
          let p2 = addPoint(seg.p2);
          if (p1.id !== p2.id) {
              if (!graph.has(p1.id)) graph.set(p1.id, new Set());
              if (!graph.has(p2.id)) graph.set(p2.id, new Set());
              graph.get(p1.id).add(p2.id);
              graph.get(p2.id).add(p1.id);
          }
      });

      return { points, graph };
  }

  _findPolygons(points, graph) {
      let halfEdges = [];
      let edgeMap = new Map(); 

      graph.forEach((neighbors, uId) => {
          let u = points[uId];
          neighbors.forEach(vId => {
              let v = points[vId];
              let angle = Math.atan2(v.y - u.y, v.x - u.x);
              let he = { origin: uId, target: vId, angle: angle, face: null, next: null };
              halfEdges.push(he);
              edgeMap.set(`${uId}_${vId}`, he);
          });
      });

      graph.forEach((neighbors, uId) => {
          let outgoing = [];
          neighbors.forEach(vId => outgoing.push(edgeMap.get(`${uId}_${vId}`)));
          outgoing.sort((a, b) => a.angle - b.angle);
          
          for (let i = 0; i < outgoing.length; i++) {
              let curr = outgoing[i];
              let targetOutgoing = [];
              graph.get(curr.target).forEach(wId => targetOutgoing.push(edgeMap.get(`${curr.target}_${wId}`)));
              targetOutgoing.sort((a, b) => a.angle - b.angle);
              
              let revIdx = targetOutgoing.findIndex(e => e.target === uId);
              if(revIdx !== -1) {
                  let nextIdx = (revIdx - 1 + targetOutgoing.length) % targetOutgoing.length;
                  curr.next = targetOutgoing[nextIdx];
              }
          }
      });

      let faces = [];
      halfEdges.forEach(he => {
          if (he.face !== null || !he.next) return; 
          let face = [];
          let curr = he;
          let infiniteSafety = 0;
          do {
              curr.face = faces.length;
              face.push(points[curr.origin]);
              curr = curr.next;
              infiniteSafety++;
          } while (curr !== he && infiniteSafety < 1000 && curr !== null);
          
          if (infiniteSafety < 1000 && face.length >= 3) {
              let area = 0;
              for(let i=0; i<face.length; i++){
                  let p1 = face[i];
                  let p2 = face[(i+1)%face.length];
                  area += (p1.x * p2.y - p2.x * p1.y);
              }
              area = area / 2;
              if (area > 10) { 
                  faces.push({ points: face, area: area });
              }
          }
      });
      return faces;
  }

  _isPointInPolygon(pt, polygon) {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          let xi = polygon[i].x, yi = polygon[i].y;
          let xj = polygon[j].x, yj = polygon[j].y;
          let intersect = ((yi > pt.y) !== (yj > pt.y))
              && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
      }
      return inside;
  }

  _getShapeSegments(shape) {
      const segments = [];
      if (shape.type === 'line') {
          segments.push({ p1: { x: shape.x1, y: shape.y1 }, p2: { x: shape.x2, y: shape.y2 } });
      } else if (shape.type === 'polygon') {
          for (let i = 0; i < shape.points.length; i++) {
              const p1 = shape.points[i];
              const p2 = shape.points[(i + 1) % shape.points.length];
              segments.push({ p1: p1, p2: p2 });
          }
      }
      return segments;
  }

  _getLineLineIntersection(segA, segB) {
      const pt = this._segmentIntersection(segA.p1, segA.p2, segB.p1, segB.p2);
      return pt ? [pt] : [];
  }

  _isPointOnArc(pt, arc) {
      if (Math.abs(Math.abs(arc.end - arc.start) - Math.PI * 2) < 0.01) return true;
      let angle = Math.atan2(pt.y - arc.cy, pt.x - arc.cx);
      const normalize = (a) => {
          let res = a % (2 * Math.PI);
          if (res < 0) res += 2 * Math.PI;
          return res;
      };
      angle = normalize(angle);
      let start = normalize(arc.start);
      let end = normalize(arc.end);
      const tol = 0.05;
      
      if (arc.counterClockwise) {
          if (start >= end) return (angle <= start + tol && angle >= end - tol);
          return (angle <= start + tol || angle >= end - tol);
      } else {
          if (start <= end) return (angle >= start - tol && angle <= end + tol);
          return (angle >= start - tol || angle <= end + tol);
      }
  }

  _getLineArcIntersection(seg, arc) {
      const pts = [];
      const dx = seg.p2.x - seg.p1.x;
      const dy = seg.p2.y - seg.p1.y;
      const a = dx * dx + dy * dy;
      if (a === 0) return pts;
      const b = 2 * (dx * (seg.p1.x - arc.cx) + dy * (seg.p1.y - arc.cy));
      const c = Math.pow(seg.p1.x - arc.cx, 2) + Math.pow(seg.p1.y - arc.cy, 2) - arc.r * arc.r;
      const det = b * b - 4 * a * c;
      if (det < 0) return pts;
      
      const checkAndAdd = (t) => {
          if (t >= 0 && t <= 1) {
              const pt = { x: seg.p1.x + t * dx, y: seg.p1.y + t * dy };
              if (this._isPointOnArc(pt, arc)) pts.push(pt);
          }
      };
      checkAndAdd((-b + Math.sqrt(det)) / (2 * a));
      if (det > 0) checkAndAdd((-b - Math.sqrt(det)) / (2 * a));
      return pts;
  }

  _getArcArcIntersection(arcA, arcB) {
      const pts = [];
      const dx = arcB.cx - arcA.cx;
      const dy = arcB.cy - arcA.cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > arcA.r + arcB.r || d < Math.abs(arcA.r - arcB.r) || d === 0) return pts;
      
      const a = (arcA.r * arcA.r - arcB.r * arcB.r + d * d) / (2 * d);
      const hSq = arcA.r * arcA.r - a * a;
      if (hSq < 0) return pts; 
      const h = Math.sqrt(hSq);
      
      const p2x = arcA.cx + a * (dx / d);
      const p2y = arcA.cy + a * (dy / d);
      
      const pt1 = { x: p2x + h * (dy / d), y: p2y - h * (dx / d) };
      const pt2 = { x: p2x - h * (dy / d), y: p2y + h * (dx / d) };
      
      if (this._isPointOnArc(pt1, arcA) && this._isPointOnArc(pt1, arcB)) pts.push(pt1);
      if (h > 0 && this._isPointOnArc(pt2, arcA) && this._isPointOnArc(pt2, arcB)) pts.push(pt2);
      
      return pts;
  }

  _computeIntersections() {
    const intersections = [];
    for (let i = 0; i < this.shapes.length; i++) {
        for (let j = i + 1; j < this.shapes.length; j++) {
            const shapeA = this.shapes[i];
            const shapeB = this.shapes[j];
            const segmentsA = this._getShapeSegments(shapeA);
            const segmentsB = this._getShapeSegments(shapeB);
            if (segmentsA.length > 0 && segmentsB.length > 0) {
                segmentsA.forEach(segA => {
                    segmentsB.forEach(segB => {
                        this._getLineLineIntersection(segA, segB).forEach(pt => intersections.push(pt));
                    });
                });
            }
            if (shapeA.type === 'arc' && shapeB.type === 'arc') {
                this._getArcArcIntersection(shapeA, shapeB).forEach(pt => intersections.push(pt));
            }
            const arcShape = shapeA.type === 'arc' ? shapeA : shapeB.type === 'arc' ? shapeB : null;
            let lineSegments = [];
            if (arcShape) {
                const otherShape = arcShape === shapeA ? shapeB : shapeA;
                if (otherShape.type !== 'arc') { 
                    lineSegments = this._getShapeSegments(otherShape);
                    lineSegments.forEach(lineSeg => {
                        this._getLineArcIntersection(lineSeg, arcShape).forEach(pt => intersections.push(pt));
                    });
                }
            }
        }
    }
    const uniqueIntersections = [];
    const precisionFactor = 10000;
    const uniqueKeys = new Set();
    intersections.forEach(pt => {
        const key = `${Math.round(pt.x * precisionFactor)}_${Math.round(pt.y * precisionFactor)}`;
        if (!uniqueKeys.has(key)) { uniqueKeys.add(key); uniqueIntersections.push(pt); }
    });
    return uniqueIntersections;
  }
  
  _collectNotablePoints() {
    const points = [];
    for (const shape of this.shapes) {
        if (shape.type === 'line') {
            points.push({ x: shape.x1, y: shape.y1 }); 
            points.push({ x: shape.x2, y: shape.y2 });
            points.push({ x: (shape.x1 + shape.x2) / 2, y: (shape.y1 + shape.y2) / 2 });
        } else if (shape.type === 'polygon') {
            for (let i = 0; i < shape.points.length; i++) {
                const p1 = shape.points[i];
                const p2 = shape.points[(i + 1) % shape.points.length];
                points.push(p1); 
                points.push({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }); 
            }
        } else if (shape.type === 'arc' || (shape.type === 'arc' && shape.start === 0 && shape.end === Math.PI * 2)) {
            points.push({ x: shape.cx, y: shape.cy }); 
            const r = shape.r;
            points.push({ x: shape.cx + r, y: shape.cy });
            points.push({ x: shape.cx - r, y: shape.cy });
            points.push({ x: shape.cx, y: shape.cy + r });
            points.push({ x: shape.cx, y: shape.cy - r });
            
            const getCoords = (angle) => ({
                x: shape.cx + r * Math.cos(angle),
                y: shape.cy + r * Math.sin(angle)
            });
            if (shape.start !== 0 || shape.end !== Math.PI * 2) {
                points.push(getCoords(shape.start));
                points.push(getCoords(shape.end));
            }
        } else if (shape.type === 'label') { 
            points.push({ x: shape.x, y: shape.y }); 
        } else if (shape.type === 'point') { 
            points.push({ x: shape.x, y: shape.y }); 
        }
    }
    return points;
  }

  _computeClosestGridVertex(clientX, clientY, force = false){
    const gridRect = this.grid.getBoundingClientRect();
    const cellUnit = this.cellSizeCSS;
    const snapStep = this.isSubGridVisible ? cellUnit / 2 : cellUnit;

    const relX = clientX - gridRect.left;
    const relY = clientY - gridRect.top;
    
    const snapThreshold = Math.pow(snapStep * 0.8, 2); 

    if (this.isIsometric) {
        const W_STEP = snapStep * Math.cos(Math.PI / 6); 
        const H_HALF_STEP = snapStep * Math.sin(Math.PI / 6); 
        const H_FULL_STEP = H_HALF_STEP * 2; 

        let approxCol = Math.round(relX / W_STEP); 
        let closestPt = null;
        let minDistSq = Infinity;

        for (let c = approxCol - 1; c <= approxCol + 1; c++) {
            const yOffset = (c % 2 !== 0) ? H_HALF_STEP : 0; 
            const xPos = c * W_STEP; 
            const r_index = Math.round((relY - yOffset) / H_FULL_STEP); 
            const yPos = r_index * H_FULL_STEP + yOffset; 
            const distSq = Math.pow(relX - xPos, 2) + Math.pow(relY - yPos, 2);
            if (distSq < minDistSq) {
                minDistSq = distSq;
                closestPt = { x: xPos, y: yPos };
            }
        }
        if (closestPt && (force || minDistSq < snapThreshold)) return { ...closestPt, isGrid: true };
        return null;
    } else {
        let col = Math.round(relX / snapStep);
        let row = Math.round(relY / snapStep);
        const vertexX = col * snapStep;
        const vertexY = row * snapStep;
        const distSq = Math.pow(relX - vertexX, 2) + Math.pow(relY - vertexY, 2);
        if (force || distSq < snapThreshold) return { x: vertexX, y: vertexY, isGrid: true };
        return null;
    }
  }
  
  _getPerpendicularPointOnSegment(point, segStart, segEnd) {
      const x = point.x, y = point.y;
      const x1 = segStart.x, y1 = segStart.y;
      const x2 = segEnd.x, y2 = segEnd.y;
      
      const A = x - x1;
      const B = y - y1;
      const C = x2 - x1;
      const D = y2 - y1;

      const dot = A * C + B * D;
      const len_sq = C * C + D * D;
      const param = (len_sq !== 0) ? (dot / len_sq) : -1;

      if (param < 0 || param > 1) return null; 

      const xx = x1 + param * C;
      const yy = y1 + param * D;

      return { x: xx, y: yy };
  }

  _getSnapPoint(clientX, clientY, isShiftDown = false) {
    let closestSnap = null;
    const gridRect = this.grid.getBoundingClientRect();
    const relX = clientX - gridRect.left;
    const relY = clientY - gridRect.top;
    
    const activeStep = this.isSubGridVisible ? this.cellSizeCSS / 2 : this.cellSizeCSS;
    const maxSnapDistSq = Math.pow(activeStep * 0.8, 2); 
    
    if(relX < -20 || relY < -20 || relX > gridRect.width + 20 || relY > gridRect.height + 20) return null;

    const isGridSnapActive = this.toggleGridSnapCheckbox.checked; 
    const isObjectSnapActive = this.toggleObjectSnapCheckbox.checked || isShiftDown;

    if (!isGridSnapActive && !isObjectSnapActive) return { x: relX, y: relY };

    if (isGridSnapActive) {
      const gridSnap = this._computeClosestGridVertex(clientX, clientY, false);
      if (gridSnap) {
        gridSnap.distSq = Math.pow(gridSnap.x - relX, 2) + Math.pow(gridSnap.y - relY, 2);
        closestSnap = gridSnap;
      }
    }
    
    if (isObjectSnapActive) {
      const notablePoints = this._collectNotablePoints(); 
      const intersectionPoints = this._computeIntersections();
      const allObjectPoints = [...notablePoints, ...intersectionPoints];
      
      for (const p of allObjectPoints) {
        const distSq = Math.pow(relX - p.x, 2) + Math.pow(relY - p.y, 2);
        if (distSq < maxSnapDistSq) {
          if (!closestSnap || distSq < closestSnap.distSq) {
            closestSnap = { x: p.x, y: p.y, isGrid: false, isObject: true, distSq: distSq };
          }
        }
      }

      if (this.tool === 'line' && this.lineStart) {
          for (const shape of this.shapes) {
              const segments = this._getShapeSegments(shape);
              for (const seg of segments) {
                  const perpPoint = this._getPerpendicularPointOnSegment(this.lineStart, seg.p1, seg.p2);
                  if (perpPoint) {
                      const distSq = Math.pow(relX - perpPoint.x, 2) + Math.pow(relY - perpPoint.y, 2);
                      if (distSq < maxSnapDistSq) {
                           if (!closestSnap || distSq < closestSnap.distSq) {
                                closestSnap = { 
                                    x: perpPoint.x, 
                                    y: perpPoint.y, 
                                    isGrid: false, 
                                    isObject: true, 
                                    isPerpendicular: true, 
                                    distSq: distSq 
                                };
                           }
                      }
                  }
              }
          }
      }
    }
    
    if(!closestSnap) {
        if (isGridSnapActive) {
            const forcedGridSnap = this._computeClosestGridVertex(clientX, clientY, true);
            if (forcedGridSnap) return forcedGridSnap;
        }
        return { x: relX, y: relY }; 
    }
    
    return closestSnap;
  }

  // =============================================================================
  // KEYBOARD E MOUSE EVENTS 
  // =============================================================================
  _bindKeyboardShortcuts(){
    window.addEventListener('keydown', (e)=>{
      
      const textModal = document.getElementById('text-prompt-modal');
      if (textModal && textModal.style.display === 'flex') return;
      const pointModal = document.getElementById('point-type-modal');
      if (pointModal && pointModal.style.display === 'flex') return;

      const input = document.getElementById('measure-input');
      const cmdInput = document.getElementById('cmd-input'); 
      const isDrawing = (this.tool === 'line' && this.isDrawingLine) || 
                        (['arc','arc-fill','circle'].includes(this.tool) && this.arcState > 1);

      if (isDrawing) {
          if (document.activeElement !== input && document.activeElement !== cmdInput && /^[0-9.,-]$/.test(e.key)) {
              input.focus();
              input.value = ''; 
          }

          if (e.key === 'Enter' && document.activeElement === input) {
              e.preventDefault();
              const val = parseFloat(input.value.replace(',', '.'));
              this._finalizeDimensionFromInput(val);
          }

          if (e.key === 'Escape') {
              input.blur();
              this._hideTooltip();
              this.lineStart = null;
              this.isDrawingLine = false;
              this._resetArc(true);
              
              this.dimStart = null;
              this.dimCenter = null;
              this.dimState = 1;

              this._clearPreview();
              this.arcStatusSpan.textContent = 'Annullato';
          }
      }

      if (document.activeElement === input || document.activeElement === cmdInput) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P') && document.activeElement !== input) {
          e.preventDefault(); 
          if (this.currentHoverSnap) {
              this.pendingPointSnap = this.currentHoverSnap;
              pointModal.style.display = 'flex';
              document.getElementById('modal-point-btn-ok').focus();
          }
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
          e.preventDefault();
          this.copySelection();
          return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
          e.preventDefault();
          this.pasteSelection();
          return;
      }

      if (e.key === 'ArrowUp') this.toggleCounterClockwiseCheckbox.click();
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedShapes.length > 0) {
          this._eraseSelectedShapes();
          e.preventDefault(); 
      }
    });
    
    this.grid.addEventListener('touchstart', (e) => {
        if(e.touches.length === 1) e.preventDefault();
    }, { passive: false });

    this.grid.addEventListener('touchmove', (e) => {
        if(e.touches.length === 1) e.preventDefault();
    }, { passive: false });

    this.grid.addEventListener('pointermove', (ev)=>{
      const snap = this._getSnapPoint(ev.clientX, ev.clientY, ev.shiftKey);
      this.currentHoverSnap = snap; 

      if (!snap) { 
          this._clearPreview(); 
          this._hideTooltip(); 
          return; 
      }
      
      this._clearPreview();
      
      let markerColor = this.selectedColor.hex;
      if (snap.isPerpendicular) {
          markerColor = '#ff00ff'; 
          this.arcStatusSpan.textContent = "⊥ Perpendicolare";
      } else if (snap.isObject) {
          markerColor = '#246eb9'; 
      }
      
      this._drawMarker(snap.x, snap.y, markerColor, false);
      
      let tooltipText = "";

      if (this.tool === 'line' && this.isDrawingLine && this.lineStart) {
        
        const angleSnapToggle = document.getElementById('toggle-angle-snap');
        if (ev.shiftKey || (angleSnapToggle && angleSnapToggle.checked)) {
            let dx = snap.x - this.lineStart.x;
            let dy = snap.y - this.lineStart.y;
            let mathAngle = Math.atan2(-dy, dx); 
            let distPx = Math.sqrt(dx * dx + dy * dy);
            const step = Math.PI / 12; 
            mathAngle = Math.round(mathAngle / step) * step;
            snap.x = this.lineStart.x + distPx * Math.cos(mathAngle);
            snap.y = this.lineStart.y - distPx * Math.sin(mathAngle); 
        }

        this._drawPreviewLine(this.lineStart.x, this.lineStart.y, snap.x, snap.y, this.selectedColor.hex);
        
        const dx = snap.x - this.lineStart.x;
        const dy = snap.y - this.lineStart.y;
        this.lastMouseAngle = Math.atan2(dy, dx); 
        const distPx = Math.sqrt(dx * dx + dy * dy);
        const distUnits = (distPx / this.cellSizeCSS).toFixed(1);
        
        let mathAngle = Math.atan2(-dy, dx);
        let deg = mathAngle * 180 / Math.PI;
        if(deg < 0) deg += 360;
        if(Math.abs(deg) < 0.1 || Math.abs(deg - 360) < 0.1) deg = 0;

        this._updateTooltip('L:', distUnits, ` | ∠ ${deg.toFixed(1)}°`, ev.clientX, ev.clientY, 'line');

      } else if (this.tool === 'polygon-border') {
        this._redrawPolygonPreview(snap);
        this._hideTooltip();

      } else if (this.tool === 'arc' || this.tool === 'arc-fill' || this.tool === 'circle') {
        if (this.arcState === 2) {
            this._drawPreviewLine(this.centerPoint.x, this.centerPoint.y, snap.x, snap.y, this.selectedColor.hex);
            const dx = snap.x - this.centerPoint.x;
            const dy = snap.y - this.centerPoint.y;
            this.lastMouseAngle = Math.atan2(dy, dx); 
            const rPx = Math.sqrt(dx * dx + dy * dy);
            const rUnits = (rPx / this.cellSizeCSS).toFixed(1);
            this._updateTooltip('R:', rUnits, '', ev.clientX, ev.clientY, 'radius');

        } else if (this.arcState === 3) {
            const dx = snap.x - this.centerPoint.x;
            const dy = snap.y - this.centerPoint.y;
            const currentEnd = Math.atan2(dy, dx);
            this._drawPreviewArc(this.centerPoint, this.radius, this.startAngle, currentEnd, (this.tool==='arc-fill'), this.isCounterClockwise);
            let diff = currentEnd - this.startAngle;
            if (this.isCounterClockwise) {
                if (diff > 0) diff -= 2 * Math.PI;
            } else {
                if (diff < 0) diff += 2 * Math.PI;
            }
            let deg = Math.abs((diff * 180) / Math.PI).toFixed(1);
            this._updateTooltip('∠', deg, '°', ev.clientX, ev.clientY, 'angle');
        }

      } else if (this.tool === 'dim-line') {
          if (this.dimStart) {
              const angleSnapToggle = document.getElementById('toggle-angle-snap');
              if (ev.shiftKey || (angleSnapToggle && angleSnapToggle.checked)) {
                  let dx = snap.x - this.dimStart.x;
                  let dy = snap.y - this.dimStart.y;
                  let mathAngle = Math.atan2(-dy, dx);
                  let distPx = Math.sqrt(dx * dx + dy * dy);
                  const step = Math.PI / 12; 
                  mathAngle = Math.round(mathAngle / step) * step;
                  snap.x = this.dimStart.x + distPx * Math.cos(mathAngle);
                  snap.y = this.dimStart.y - distPx * Math.sin(mathAngle);
              }

              this._drawPreviewLine(this.dimStart.x, this.dimStart.y, snap.x, snap.y, this.selectedColor.hex);
              const dx = snap.x - this.dimStart.x;
              const dy = snap.y - this.dimStart.y;
              const distPx = Math.sqrt(dx * dx + dy * dy);
              const distUnits = (distPx / this.cellSizeCSS).toFixed(1);
              
              let mathAngle = Math.atan2(-dy, dx);
              let deg = mathAngle * 180 / Math.PI;
              if(deg < 0) deg += 360;
              if(Math.abs(deg) < 0.1 || Math.abs(deg - 360) < 0.1) deg = 0;

              this._updateTooltip('L:', distUnits, ` | ∠ ${deg.toFixed(1)}°`, ev.clientX, ev.clientY, 'none');
          } else { this._hideTooltip(); }

      } else if (this.tool === 'dim-rad') {
          if (this.dimCenter) {
              this._drawPreviewLine(this.dimCenter.x, this.dimCenter.y, snap.x, snap.y, this.selectedColor.hex);
              const dx = snap.x - this.dimCenter.x;
              const dy = snap.y - this.dimCenter.y;
              const rPx = Math.sqrt(dx * dx + dy * dy);
              const rUnits = (rPx / this.cellSizeCSS).toFixed(1);
              this._updateTooltip('R:', rUnits, '', ev.clientX, ev.clientY, 'none');
          } else { this._hideTooltip(); }

      } else if (this.tool === 'dim-ang') {
          if (this.dimState === 2) {
              this._drawPreviewLine(this.dimCenter.x, this.dimCenter.y, snap.x, snap.y, this.selectedColor.hex);
              this._hideTooltip();
          } else if (this.dimState === 3) {
              const dx = snap.x - this.dimCenter.x;
              const dy = snap.y - this.dimCenter.y;
              const currentEnd = Math.atan2(dy, dx);
              this._drawPreviewArc(this.dimCenter, this.dimRadius, this.dimStartAngle, currentEnd, false, this.isCounterClockwise);
              
              let diff = currentEnd - this.dimStartAngle;
              if (this.isCounterClockwise) {
                  if (diff > 0) diff -= 2 * Math.PI;
              } else {
                  if (diff < 0) diff += 2 * Math.PI;
              }
              let deg = Math.abs((diff * 180) / Math.PI).toFixed(1);
              this._updateTooltip('∠', deg, '°', ev.clientX, ev.clientY, 'none');
          } else { this._hideTooltip(); }

      } else if (this.tool === 'move' && this.moveState.isMoving) {
          const dx = snap.x - this.moveState.startPoint.x;
          const dy = snap.y - this.moveState.startPoint.y;
          if (this.moveState.shapes) {
              this.moveState.shapes.forEach(s => this._drawShapePreview(this._applyOffset(s, dx, dy)));
          } else {
              const tempShape = this._applyOffset(this.moveState.shape, dx, dy);
              this._drawShapePreview(tempShape);
          }
          this._hideTooltip();
      } else {
          this._hideTooltip();
      }
    });

    this.grid.addEventListener('pointerdown', (ev)=>{
      const input = document.getElementById('measure-input');
      if(document.activeElement === input) {
          input.blur();
      }

      ev.preventDefault();
      const currentTool = this.tool;
      const gridRect = this.grid.getBoundingClientRect();
      const clickX = ev.clientX - gridRect.left;
      const clickY = ev.clientY - gridRect.top;
      
      if (currentTool === 'bucket') { this._handleBucketClick(ev); return; }
      if (currentTool === 'select') { this._handleSelectClick(clickX, clickY, ev.shiftKey); return; }
      if (currentTool === 'erase') { this._handleEraseClick(clickX, clickY); return; }
      
      const snap = this._getSnapPoint(ev.clientX, ev.clientY, ev.shiftKey);
      if (!snap) return; 
      
      if (currentTool === 'move') this._handleMoveClick(snap); 
      else if (currentTool === 'line') this._handleLineClick(snap, ev); 
      else if (currentTool === 'polygon-border') this._handlePolygonClick(snap);
      else if (['arc','arc-fill','circle'].includes(currentTool)) this._handleArcClick(snap);
      else if (currentTool === 'label') this._handleLabelClick(snap); 
      else if (currentTool === 'dim-line') this._handleDimLineClick(snap, ev);
      else if (currentTool === 'dim-rad') this._handleDimRadClick(snap);
      else if (currentTool === 'dim-ang') this._handleDimAngClick(snap);
    });
  }

  // =========================================================================
  // LOGICHE DI DISEGNO 
  // =========================================================================
  copySelection() {
      if (this.selectedShapes.length === 0) return;
      this.clipboard = this.selectedShapes.map(index => {
          return JSON.parse(JSON.stringify(this.shapes[index]));
      });
      this.arcStatusSpan.textContent = `Copiati ${this.clipboard.length} elementi`;
      const btn = document.getElementById('btn-copy');
      btn.style.backgroundColor = '#dbeafe';
      setTimeout(()=> btn.style.backgroundColor = '#f8fafc', 200);
  }

  pasteSelection() {
      if (!this.clipboard || this.clipboard.length === 0) return;
      this.selectedShapes = [];
      const offset = 20; 
      const newIndices = [];

      this.clipboard.forEach(shape => {
          const newShape = JSON.parse(JSON.stringify(shape));
          if (newShape.type === 'line') {
              newShape.x1 += offset; newShape.y1 += offset;
              newShape.x2 += offset; newShape.y2 += offset;
          } else if (newShape.type === 'polygon') {
              newShape.points = newShape.points.map(p => ({ x: p.x + offset, y: p.y + offset }));
          } else if (newShape.type === 'arc') {
              newShape.cx += offset; newShape.cy += offset;
          } else if (newShape.type === 'label' || newShape.type === 'point') {
              newShape.x += offset; newShape.y += offset;
          }
          this.shapes.push(newShape);
          newIndices.push(this.shapes.length - 1);
      });

      this.selectedShapes = newIndices;
      this.redoShapes = []; 
      this._saveStateForTutorial();
      this._redrawPermShapes();
      this.arcStatusSpan.textContent = `Incollati ${this.clipboard.length} elementi`;
      this.eraseSelectedBtn.style.display = 'inline';
      
      const btn = document.getElementById('btn-paste');
      btn.style.backgroundColor = '#dbeafe';
      setTimeout(()=> btn.style.backgroundColor = '#f8fafc', 200);
  }

  _handleMoveClick(snap) {
      if (!this.moveState.isMoving) {
          // Se c'è già una selezione multipla attiva (fatta con "Seleziona" + shift-click,
          // o dal pannello Filtra), spostiamo tutte le forme selezionate insieme, come gruppo.
          if (this.selectedShapes.length > 0) {
              const indices = [...this.selectedShapes].sort((a, b) => b - a); // decrescente, per rimuovere in sicurezza
              this.moveState.isMoving = true;
              this.moveState.shapes = indices.map(i => JSON.parse(JSON.stringify(this.shapes[i])));
              this.moveState.shape = null;
              this.moveState.startPoint = { x: snap.x, y: snap.y };
              indices.forEach(i => this.shapes.splice(i, 1));
              this.selectedShapes = [];
              this.eraseSelectedBtn.style.display = 'none';
              this._redrawPermShapes();
              this.arcStatusSpan.textContent = `Sposta Gruppo (${this.moveState.shapes.length}): Clicca destinazione`;
              return;
          }
          const idx = this._findShapeIndexAt(snap.x, snap.y);
          if (idx !== -1) {
              this.moveState.isMoving = true;
              this.moveState.shape = JSON.parse(JSON.stringify(this.shapes[idx])); 
              this.moveState.shapes = null;
              this.moveState.startPoint = { x: snap.x, y: snap.y };
              this.shapes.splice(idx, 1);
              this._redrawPermShapes();
              this.arcStatusSpan.textContent = "Sposta: Clicca destinazione";
          }
      } else {
          const dx = snap.x - this.moveState.startPoint.x;
          const dy = snap.y - this.moveState.startPoint.y;

          if (this.moveState.shapes) {
              const movedShapes = this.moveState.shapes.map(s => this._applyOffset(s, dx, dy));
              const startIdx = this.shapes.length;
              this.shapes.push(...movedShapes);
              // Riseleziona il gruppo appena spostato, comodo per un altro spostamento o per modificarlo.
              this.selectedShapes = movedShapes.map((_, i) => startIdx + i);
              this.eraseSelectedBtn.style.display = this.selectedShapes.length > 0 ? 'inline' : 'none';
          } else {
              const movedShape = this._applyOffset(this.moveState.shape, dx, dy);
              this.shapes.push(movedShape);
          }

          this.redoShapes = []; 
          this.moveState.isMoving = false;
          this.moveState.shape = null;
          this.moveState.shapes = null;
          this.moveState.startPoint = null;
          this._saveStateForTutorial();
          this._redrawPermShapes();
          this._clearPreview();
          this.arcStatusSpan.textContent = "Sposta: Seleziona oggetto";
      }
  }

  _applyOffset(shape, dx, dy) {
      const newShape = JSON.parse(JSON.stringify(shape));
      if (newShape.type === 'line') {
          newShape.x1 += dx; newShape.y1 += dy;
          newShape.x2 += dx; newShape.y2 += dy;
      } else if (newShape.type === 'polygon') {
          newShape.points = newShape.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
      } else if (newShape.type === 'arc') {
          newShape.cx += dx; newShape.cy += dy;
      } else if (newShape.type === 'label' || newShape.type === 'point') {
          newShape.x += dx; newShape.y += dy;
      }
      return newShape;
  }

  _isShapeHidden(shape) {
      if (shape.type === 'point') {
          return this.hiddenPointColors.has(shape.color);
      }
      if (shape.type === 'label') {
          const text = (shape.text || '').trim();
          if (text === '') return false;
          if (this.hideNumberLabels && /^[0-9]+$/.test(text)) return true;
          if (this.hideUpperLabels && /^[A-ZÀÈÉÌÒÙ]+$/.test(text)) return true;
          if (this.hideLowerLabels && /^[a-zàèéìòù]+$/.test(text)) return true;
          return false;
      }
      if (shape.type === 'line') {
          if (this.hiddenLineWidths.has(shape.width)) return true;
          if (this.hiddenLineColors.has(shape.color)) return true;
          return false;
      }
      return false;
  }

  _indicesForLineWidth(width) {
      const indices = [];
      this.shapes.forEach((shape, idx) => {
          if (shape.type === 'line' && shape.width === width) indices.push(idx);
      });
      return indices;
  }

  _indicesForLineColor(color) {
      const indices = [];
      this.shapes.forEach((shape, idx) => {
          if (shape.type === 'line' && shape.color === color) indices.push(idx);
      });
      return indices;
  }

  _indicesForLabelCategory(kind) {
      const indices = [];
      this.shapes.forEach((shape, idx) => {
          if (shape.type !== 'label') return;
          const text = (shape.text || '').trim();
          if (text === '') return;
          if (kind === 'upper' && /^[A-ZÀÈÉÌÒÙ]+$/.test(text)) indices.push(idx);
          if (kind === 'lower' && /^[a-zàèéìòù]+$/.test(text)) indices.push(idx);
          if (kind === 'number' && /^[0-9]+$/.test(text)) indices.push(idx);
      });
      return indices;
  }

  _indicesForPointColor(color) {
      const indices = [];
      this.shapes.forEach((shape, idx) => {
          if (shape.type === 'point' && shape.color === color) indices.push(idx);
      });
      return indices;
  }

  _applyCategorySelection(checked, indices) {
      if (checked) {
          indices.forEach(i => { if (!this.selectedShapes.includes(i)) this.selectedShapes.push(i); });
      } else {
          this.selectedShapes = this.selectedShapes.filter(i => !indices.includes(i));
      }
      this.eraseSelectedBtn.style.display = this.selectedShapes.length > 0 ? 'inline' : 'none';
      this._redrawPermShapes();
  }

  _bindVisibilityFilter() {
      const btn = document.getElementById('btn-visibility-filter');
      const dropdown = document.getElementById('visibility-dropdown');
      const colorList = document.getElementById('visibility-color-list');
      const lineWidthList = document.getElementById('visibility-linewidth-list');
      const lineColorList = document.getElementById('visibility-linecolor-list');
      const checkUpper = document.getElementById('vis-hide-upper');
      const checkLower = document.getElementById('vis-hide-lower');
      const checkNumbers = document.getElementById('vis-hide-numbers');
      const selectUpper = document.getElementById('vis-select-upper');
      const selectLower = document.getElementById('vis-select-lower');
      const selectNumbers = document.getElementById('vis-select-numbers');
      if (!btn || !dropdown) return;

      const renderColorList = () => {
          const colors = [];
          const seen = new Set();
          this.shapes.forEach(shape => {
              if (shape.type === 'point' && !seen.has(shape.color)) {
                  seen.add(shape.color);
                  colors.push(shape.color);
              }
          });

          colorList.innerHTML = '';
          if (colors.length === 0) {
              const empty = document.createElement('div');
              empty.className = 'visibility-empty';
              empty.textContent = 'Nessun punto inserito';
              colorList.appendChild(empty);
              return;
          }
          colors.forEach(color => {
              const row = document.createElement('div');
              row.className = 'visibility-check-row';

              const text = document.createElement('span');
              text.className = 'visibility-check-text';
              const swatch = document.createElement('span');
              swatch.className = 'visibility-color-swatch';
              swatch.style.backgroundColor = color;
              text.appendChild(swatch);
              text.appendChild(document.createTextNode(color));

              const hideInput = document.createElement('input');
              hideInput.type = 'checkbox';
              hideInput.title = 'Nascondi';
              hideInput.checked = this.hiddenPointColors.has(color);
              hideInput.addEventListener('change', () => {
                  if (hideInput.checked) this.hiddenPointColors.add(color);
                  else this.hiddenPointColors.delete(color);
                  this._redrawPermShapes();
              });

              const selectInput = document.createElement('input');
              selectInput.type = 'checkbox';
              selectInput.title = 'Seleziona';
              selectInput.addEventListener('change', () => {
                  this._applyCategorySelection(selectInput.checked, this._indicesForPointColor(color));
              });

              row.appendChild(text);
              row.appendChild(hideInput);
              row.appendChild(selectInput);
              colorList.appendChild(row);
          });
      };

      const renderLineWidthList = () => {
          const widths = [];
          const seen = new Set();
          this.shapes.forEach(shape => {
              if (shape.type === 'line' && !seen.has(shape.width)) {
                  seen.add(shape.width);
                  widths.push(shape.width);
              }
          });
          widths.sort((a, b) => a - b);

          lineWidthList.innerHTML = '';
          if (widths.length === 0) {
              const empty = document.createElement('div');
              empty.className = 'visibility-empty';
              empty.textContent = 'Nessuna linea inserita';
              lineWidthList.appendChild(empty);
              return;
          }
          widths.forEach(width => {
              const row = document.createElement('div');
              row.className = 'visibility-check-row';

              const text = document.createElement('span');
              text.className = 'visibility-check-text';
              const swatch = document.createElement('span');
              swatch.className = 'visibility-width-swatch';
              swatch.style.height = Math.min(width, 8) + 'px';
              text.appendChild(swatch);
              text.appendChild(document.createTextNode(width + ' px'));

              const hideInput = document.createElement('input');
              hideInput.type = 'checkbox';
              hideInput.title = 'Nascondi';
              hideInput.checked = this.hiddenLineWidths.has(width);
              hideInput.addEventListener('change', () => {
                  if (hideInput.checked) this.hiddenLineWidths.add(width);
                  else this.hiddenLineWidths.delete(width);
                  this._redrawPermShapes();
              });

              const selectInput = document.createElement('input');
              selectInput.type = 'checkbox';
              selectInput.title = 'Seleziona';
              selectInput.addEventListener('change', () => {
                  this._applyCategorySelection(selectInput.checked, this._indicesForLineWidth(width));
              });

              row.appendChild(text);
              row.appendChild(hideInput);
              row.appendChild(selectInput);
              lineWidthList.appendChild(row);
          });
      };

      const renderLineColorList = () => {
          const colors = [];
          const seen = new Set();
          this.shapes.forEach(shape => {
              if (shape.type === 'line' && !seen.has(shape.color)) {
                  seen.add(shape.color);
                  colors.push(shape.color);
              }
          });

          lineColorList.innerHTML = '';
          if (colors.length === 0) {
              const empty = document.createElement('div');
              empty.className = 'visibility-empty';
              empty.textContent = 'Nessuna linea inserita';
              lineColorList.appendChild(empty);
              return;
          }
          colors.forEach(color => {
              const row = document.createElement('div');
              row.className = 'visibility-check-row';

              const text = document.createElement('span');
              text.className = 'visibility-check-text';
              const swatch = document.createElement('span');
              swatch.className = 'visibility-color-swatch';
              swatch.style.backgroundColor = color;
              text.appendChild(swatch);
              text.appendChild(document.createTextNode(color));

              const hideInput = document.createElement('input');
              hideInput.type = 'checkbox';
              hideInput.title = 'Nascondi';
              hideInput.checked = this.hiddenLineColors.has(color);
              hideInput.addEventListener('change', () => {
                  if (hideInput.checked) this.hiddenLineColors.add(color);
                  else this.hiddenLineColors.delete(color);
                  this._redrawPermShapes();
              });

              const selectInput = document.createElement('input');
              selectInput.type = 'checkbox';
              selectInput.title = 'Seleziona';
              selectInput.addEventListener('change', () => {
                  this._applyCategorySelection(selectInput.checked, this._indicesForLineColor(color));
              });

              row.appendChild(text);
              row.appendChild(hideInput);
              row.appendChild(selectInput);
              lineColorList.appendChild(row);
          });
      };

      btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const opening = dropdown.style.display !== 'block';
          if (opening) {
              renderColorList();
              renderLineWidthList();
              renderLineColorList();
          }
          dropdown.style.display = opening ? 'block' : 'none';
      });

      dropdown.addEventListener('click', (e) => e.stopPropagation());

      document.addEventListener('click', () => {
          dropdown.style.display = 'none';
      });

      checkUpper.addEventListener('change', () => {
          this.hideUpperLabels = checkUpper.checked;
          this._redrawPermShapes();
      });
      checkLower.addEventListener('change', () => {
          this.hideLowerLabels = checkLower.checked;
          this._redrawPermShapes();
      });
      checkNumbers.addEventListener('change', () => {
          this.hideNumberLabels = checkNumbers.checked;
          this._redrawPermShapes();
      });

      selectUpper.addEventListener('change', () => {
          this._applyCategorySelection(selectUpper.checked, this._indicesForLabelCategory('upper'));
      });
      selectLower.addEventListener('change', () => {
          this._applyCategorySelection(selectLower.checked, this._indicesForLabelCategory('lower'));
      });
      selectNumbers.addEventListener('change', () => {
          this._applyCategorySelection(selectNumbers.checked, this._indicesForLabelCategory('number'));
      });
  }

  _findShapeIndexAt(x, y) {
     const ctx = this.previewCtx; 
     const dpr = window.devicePixelRatio || 1;
     ctx.setTransform(1,0,0,1,0,0); 
     
     let foundIdx = -1;
     for (let i = this.shapes.length - 1; i >= 0; i--) {
        const shape = this.shapes[i];
        if (this._isShapeHidden(shape)) continue;
        ctx.beginPath();
        ctx.lineWidth = Math.max(10, shape.width + 10); 
        
        if(shape.type === 'line'){
            ctx.moveTo(shape.x1, shape.y1); ctx.lineTo(shape.x2, shape.y2);
            if(ctx.isPointInStroke(x, y)) { foundIdx = i; break; }
        } else if(shape.type === 'polygon') {
            ctx.moveTo(shape.points[0].x, shape.points[0].y);
            for(let k=1; k<shape.points.length; k++) ctx.lineTo(shape.points[k].x, shape.points[k].y);
            ctx.closePath();
            
            let hitStroke = (shape.hasBorder !== false) && ctx.isPointInStroke(x, y);
            let hitFill = shape.filled && ctx.isPointInPath(x, y);
            if(hitStroke || hitFill) { foundIdx = i; break; }
            
        } else if(shape.type === 'arc') {
             if (shape.filled) {
                 ctx.moveTo(shape.cx, shape.cy);
                 ctx.arc(shape.cx, shape.cy, shape.r, shape.start, shape.end, shape.counterClockwise);
                 ctx.closePath();
             } else {
                 ctx.arc(shape.cx, shape.cy, shape.r, shape.start, shape.end, shape.counterClockwise);
             }
             
             let hitStroke = (shape.hasBorder !== false) && ctx.isPointInStroke(x, y);
             let hitFill = shape.filled && ctx.isPointInPath(x, y);
             if(hitStroke || hitFill) { foundIdx = i; break; }
             
        } else if (shape.type === 'label') {
             if(x > shape.x - 20 && x < shape.x + 20 && y > shape.y - 10 && y < shape.y + 10) { foundIdx = i; break; }
        } else if (shape.type === 'point') {
             const rad = Math.max(2, shape.width * 1.5) + 5; 
             if (Math.pow(x - shape.x, 2) + Math.pow(y - shape.y, 2) <= Math.pow(rad, 2)) { foundIdx = i; break; }
        }
     }
     ctx.setTransform(dpr,0,0,dpr,0,0);
     return foundIdx;
  }

  _drawShapePreview(shape) {
      const ctx = this.previewCtx;
      if(!ctx) return;
      
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; 
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = shape.width;
      ctx.setLineDash([4,4]);

      ctx.beginPath();
      if (shape.type === 'line') {
          ctx.moveTo(shape.x1, shape.y1); ctx.lineTo(shape.x2, shape.y2);
          ctx.stroke();
      } else if (shape.type === 'polygon') {
          ctx.moveTo(shape.points[0].x, shape.points[0].y);
          for(let i=1; i<shape.points.length; i++) ctx.lineTo(shape.points[i].x, shape.points[i].y);
          ctx.closePath();
          if (shape.hasBorder !== false) ctx.stroke();
          if(shape.filled) ctx.fill();
      } else if (shape.type === 'arc') {
          if (!shape.filled) {
              ctx.arc(shape.cx, shape.cy, shape.r, shape.start, shape.end, shape.counterClockwise);
              if (shape.hasBorder !== false) ctx.stroke();
          } else {
              ctx.moveTo(shape.cx, shape.cy);
              ctx.arc(shape.cx, shape.cy, shape.r, shape.start, shape.end, shape.counterClockwise);
              ctx.closePath();
              if (shape.hasBorder !== false) ctx.stroke();
              ctx.fill();
          }
      } else if (shape.type === 'label') {
          const fontWeight = shape.isBold !== false ? 'bold' : 'normal';
          ctx.font = `${fontWeight} ${shape.size}px ${shape.font}`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.strokeText(shape.text, shape.x, shape.y);
      }
      ctx.restore();
  }
  
  _handleLineClick(snap, ev){
      if (!this.lineStart) {
        this.lineStart = { x: snap.x, y: snap.y }; 
        this.isDrawingLine = true;
        this.arcStatusSpan.textContent = 'Fine Linea';
      } else {
        let finalX = snap.x;
        let finalY = snap.y;

        const angleSnapToggle = document.getElementById('toggle-angle-snap');
        if (ev && (ev.shiftKey || (angleSnapToggle && angleSnapToggle.checked))) {
            let dx = finalX - this.lineStart.x;
            let dy = finalY - this.lineStart.y;
            let mathAngle = Math.atan2(-dy, dx);
            let distPx = Math.sqrt(dx * dx + dy * dy);
            const step = Math.PI / 12; 
            mathAngle = Math.round(mathAngle / step) * step;
            finalX = this.lineStart.x + distPx * Math.cos(mathAngle);
            finalY = this.lineStart.y - distPx * Math.sin(mathAngle);
        }

        this.shapes.push({ 
          type: 'line', x1: this.lineStart.x, y1: this.lineStart.y, x2: finalX, y2: finalY, 
          color: this.selectedColor.hex, width: this.strokeWidth, dashed: this.isDashed,
          arrowStart: this.isArrowStart, arrowEnd: this.isArrowEnd 
        });
        this.redoShapes = []; 
        this._saveStateForTutorial();
        this._redrawPermShapes();
        this.lineStart = null;
        this.isDrawingLine = false;
        this._clearPreview();
        this._hideTooltip();
        this.arcStatusSpan.textContent = 'Inizio Linea';
      }
  }
  
  _handlePolygonClick(snap) {
      const currentPoint = { x: snap.x, y: snap.y };
      if (this.currentPolygonPoints.length === 0) {
          this.currentPolygonPoints.push(currentPoint);
          this.arcStatusSpan.textContent = 'Clicca per chiudere';
      } else {
          const firstPoint = this.currentPolygonPoints[0];
          const isClosing = (Math.abs(currentPoint.x - firstPoint.x) < 5 && Math.abs(currentPoint.y - firstPoint.y) < 5);
          if (isClosing && this.currentPolygonPoints.length >= 3) {
              this.shapes.push({
                  type: 'polygon', points: [...this.currentPolygonPoints], 
                  color: this.selectedColor.hex, width: this.strokeWidth, filled: false, dashed: this.isDashed
              });
              this.redoShapes = []; 
              this._saveStateForTutorial();
              this._redrawPermShapes();
              this.currentPolygonPoints = [];
              this._clearPreview();
              this.arcStatusSpan.textContent = 'Nuovo Poligono';
          } else {
              this.currentPolygonPoints.push(currentPoint);
          }
      }
  }

  _handleBucketClick(ev){
    const gridRect = this.grid.getBoundingClientRect();
    const clickX = ev.clientX - gridRect.left;
    const clickY = ev.clientY - gridRect.top;
    
    this.arcStatusSpan.textContent = "Calcolo area...";
    
    const { points, graph } = this._buildPlanarGraph();
    const faces = this._findPolygons(points, graph);
    let enclosingFaces = faces.filter(f => this._isPointInPolygon({x: clickX, y: clickY}, f.points));
    
    if (enclosingFaces.length > 0) {
        enclosingFaces.sort((a, b) => a.area - b.area);
        const targetFace = enclosingFaces[0];
        
        const w = this.grid.offsetWidth;
        const h = this.grid.offsetHeight;
        const maxAllowedArea = (w * h) * 0.95; 

        if (targetFace.area >= maxAllowedArea) {
            this.arcStatusSpan.textContent = "Sfondo non riempibile";
            setTimeout(() => { if(this.arcStatusSpan.textContent === "Sfondo non riempibile") this.arcStatusSpan.textContent = ""; }, 2000);
            return;
        }
        
        this.shapes.push({
            type: 'polygon',
            points: targetFace.points,
            color: this.selectedColor.hex,
            width: 0, 
            filled: true,
            hasBorder: false, 
            dashed: false
        });
        
        this.redoShapes = []; 
        this._saveStateForTutorial();
        this._redrawPermShapes();
        this.arcStatusSpan.textContent = "Area Riempita";
        setTimeout(() => { if(this.arcStatusSpan.textContent === "Area Riempita") this.arcStatusSpan.textContent = ""; }, 2000);
        return;
    }

    const ctx = this.previewCtx;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1,0,0,1,0,0);
    
    let found = null;
    for (const shape of this.shapes) {
        ctx.beginPath();
        if (shape.type === 'polygon' && shape.points.length >= 3) {
            ctx.moveTo(shape.points[0].x, shape.points[0].y);
            for(let i=1; i<shape.points.length; i++) ctx.lineTo(shape.points[i].x, shape.points[i].y);
            ctx.closePath();
        } else if (shape.type === 'arc' && shape.r > 0) { 
            ctx.arc(shape.cx, shape.cy, shape.r, 0, Math.PI * 2); 
        } else continue;
        
        if (ctx.isPointInPath(clickX, clickY)) found = shape;
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);
    
    if (found) {
        let fillShape = JSON.parse(JSON.stringify(found));
        fillShape.color = this.selectedColor.hex;
        fillShape.width = 0;
        fillShape.filled = true;
        fillShape.hasBorder = false; 
        
        this.shapes.push(fillShape);
        
        this.redoShapes = []; 
        this._saveStateForTutorial();
        this._redrawPermShapes();
        this.arcStatusSpan.textContent = "Oggetto Riempito";
        setTimeout(() => { if(this.arcStatusSpan.textContent === "Oggetto Riempito") this.arcStatusSpan.textContent = ""; }, 2000);
    } else {
        this.arcStatusSpan.textContent = "Nessun confine chiuso";
        setTimeout(() => { if(this.arcStatusSpan.textContent === "Nessun confine chiuso") this.arcStatusSpan.textContent = ""; }, 2000);
    }
  }

  _handleSelectClick(clickX, clickY, isShiftDown){
     const idx = this._findShapeIndexAt(clickX, clickY);

     if(idx !== -1){
         if(isShiftDown) {
             const exist = this.selectedShapes.indexOf(idx);
             if(exist > -1) this.selectedShapes.splice(exist, 1);
             else this.selectedShapes.push(idx);
         } else {
             this.selectedShapes = [idx];
         }
     } else if(!isShiftDown) {
         this.selectedShapes = [];
     }
     
     this.eraseSelectedBtn.style.display = this.selectedShapes.length > 0 ? 'inline' : 'none';
     this._redrawPermShapes();
  }
  
  _handleEraseClick(clickX, clickY) {
     this._handleSelectClick(clickX, clickY, false);
     if(this.selectedShapes.length > 0) this._eraseSelectedShapes();
  }
  
  _eraseSelectedShapes() {
      this.selectedShapes.sort((a,b)=>b-a).forEach(idx => {
          this.redoShapes.push(this.shapes[idx]); 
          this.shapes.splice(idx, 1);
      });
      this.selectedShapes = [];
      this._saveStateForTutorial();
      this._redrawPermShapes();
      this.eraseSelectedBtn.style.display = 'none';
  }

  _drawArrowHead(ctx, x, y, angle, color, shapeWidth) {
      const currentWidth = shapeWidth || this.strokeWidth;
      const headLen = currentWidth * 4 + 5; 
      ctx.save();
      ctx.beginPath();
      ctx.lineWidth = currentWidth;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.moveTo(x, y);
      ctx.lineTo(x - headLen * Math.cos(angle - Math.PI / 6), y - headLen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(x, y);
      ctx.lineTo(x - headLen * Math.cos(angle + Math.PI / 6), y - headLen * Math.sin(angle + Math.PI / 6));
      
      ctx.stroke();
      ctx.restore();
  }

  _redrawPermShapes() {
      if(!this.permCtx) return;
      const cssW = this.grid.offsetWidth; 
      const cssH = this.grid.offsetHeight;
      this.permCtx.clearRect(0,0,cssW,cssH);
      
      const isTutorialActive = this.currentTutorialIndex >= 0 && this.ghostShapes && this.ghostShapes.length > 0;

      if (isTutorialActive) {
          if (this.isGhostMode) {
              this.permCtx.save();
              this.permCtx.globalAlpha = 0.35; 
              this._drawShapeList(this.ghostShapes, true, false);
              this.permCtx.restore();
              
              this._drawShapeList(this.shapes, false, false);
          } else {
              this._drawShapeList(this.ghostShapes, true, true);
              this._drawShapeList(this.shapes, false, false);
          }
      } else {
          this._drawShapeList(this.shapes, false, false);
      }
  }

  _drawShapeList(shapeArray, isGhost, isDemo = false) {
      shapeArray.forEach((shape, index) => {
          const isSelected = (!isGhost && !isDemo) && this.selectedShapes.includes(index);

          if (this._isShapeHidden(shape) && !isSelected) return;

          this.permCtx.save();

          // --- Riempimento (se previsto): disegnato per primo, PER QUESTA FORMA ---
          if (shape.filled) {
              this.permCtx.fillStyle = shape.color;
              this.permCtx.beginPath();
              if (shape.type === 'polygon') {
                  this.permCtx.moveTo(shape.points[0].x, shape.points[0].y);
                  for(let i=1; i<shape.points.length; i++) this.permCtx.lineTo(shape.points[i].x, shape.points[i].y);
                  this.permCtx.closePath();
              } else if (shape.type === 'arc') {
                  this.permCtx.moveTo(shape.cx, shape.cy);
                  this.permCtx.arc(shape.cx, shape.cy, shape.r, shape.start, shape.end, shape.counterClockwise);
                  this.permCtx.closePath();
              }
              this.permCtx.fill();
          }

          if (shape.hasBorder === false && !isSelected) { this.permCtx.restore(); return; }

          // --- Contorno / linea / etichetta / punto: disegnato subito dopo, sempre PER QUESTA FORMA,
          //     così l'ordine avanti/indietro vale per l'intera figura e non solo per il riempimento ---
          this.permCtx.strokeStyle = isSelected ? 'var(--focus-color)' : shape.color;
          this.permCtx.lineWidth = (shape.hasBorder === false) ? 2 : shape.width; 
          this.permCtx.lineCap = 'round';
          if (shape.dashed) this.permCtx.setLineDash([8, 8]);
          if (isSelected) this.permCtx.setLineDash([4, 4]);

          this.permCtx.beginPath();
          if (shape.type === 'line') {
              this.permCtx.moveTo(shape.x1, shape.y1); this.permCtx.lineTo(shape.x2, shape.y2);
              this.permCtx.stroke(); 
              
              const angle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
              if (shape.arrowStart) this._drawArrowHead(this.permCtx, shape.x1, shape.y1, angle + Math.PI, shape.color, shape.width);
              if (shape.arrowEnd) this._drawArrowHead(this.permCtx, shape.x2, shape.y2, angle, shape.color, shape.width);

          } else if (shape.type === 'arc') {
              if (!shape.filled) this.permCtx.arc(shape.cx, shape.cy, shape.r, shape.start, shape.end, shape.counterClockwise);
              else {
                  this.permCtx.moveTo(shape.cx, shape.cy);
                  this.permCtx.arc(shape.cx, shape.cy, shape.r, shape.start, shape.end, shape.counterClockwise);
                  this.permCtx.closePath(); 
              }
              if (shape.hasBorder !== false || isSelected) this.permCtx.stroke();
              
          } else if (shape.type === 'polygon') {
              this.permCtx.moveTo(shape.points[0].x, shape.points[0].y);
              for(let i=1; i<shape.points.length; i++) this.permCtx.lineTo(shape.points[i].x, shape.points[i].y);
              this.permCtx.closePath(); 
              
              if (shape.hasBorder !== false || isSelected) this.permCtx.stroke();
              
          } else if (shape.type === 'label') {
              const fontWeight = shape.isBold !== false ? 'bold' : 'normal';
              this.permCtx.fillStyle = shape.color;
              this.permCtx.font = `${fontWeight} ${shape.size * 1.1}px ${shape.font}`;
              this.permCtx.textAlign = 'left';
              this.permCtx.textBaseline = 'middle';
              
              if(!isGhost || isDemo) {
                  this.permCtx.strokeStyle = "white";
                  this.permCtx.lineWidth = 3;
                  this.permCtx.lineJoin = "round";
                  this.permCtx.strokeText(shape.text, shape.x, shape.y);
              }
              this.permCtx.fillText(shape.text, shape.x, shape.y);
              if(isSelected) {
                  this.permCtx.strokeStyle = 'var(--focus-color)';
                  this.permCtx.lineWidth = 1;
                  this.permCtx.strokeText(shape.text, shape.x, shape.y);
              }
              this.permCtx.stroke(); 
          } else if (shape.type === 'point') {
              this.permCtx.fillStyle = shape.color;
              const rad = Math.max(2, shape.width * 1.5);
              this.permCtx.arc(shape.x, shape.y, rad, 0, Math.PI * 2);
              this.permCtx.fill();
              if(isSelected) {
                  this.permCtx.strokeStyle = 'var(--focus-color)';
                  this.permCtx.lineWidth = 2;
                  this.permCtx.stroke();
              }
          }
          this.permCtx.restore();
      });
  }

  _drawPreviewLine(x1,y1,x2,y2,color){
    if(!this.previewCtx) return;
    this.previewCtx.clearRect(0,0,this.grid.offsetWidth,this.grid.offsetHeight);
    this._drawMarker(x1,y1,color,false); this._drawMarker(x2,y2,color,false);
    
    this.previewCtx.save();
    this.previewCtx.setLineDash([8,6]); 
    this.previewCtx.strokeStyle = color;
    this.previewCtx.lineWidth = this.strokeWidth; 
    this.previewCtx.beginPath();
    this.previewCtx.moveTo(x1, y1);
    this.previewCtx.lineTo(x2, y2);
    this.previewCtx.stroke();
    
    const angle = Math.atan2(y2 - y1, x2 - x1);
    if (this.isArrowStart || this.tool === 'dim-line') this._drawArrowHead(this.previewCtx, x1, y1, angle + Math.PI, color, this.strokeWidth);
    if (this.isArrowEnd || this.tool === 'dim-line' || this.tool === 'dim-rad') this._drawArrowHead(this.previewCtx, x2, y2, angle, color, this.strokeWidth);

    this.previewCtx.restore();
  }
  
  _redrawPolygonPreview(hoverPoint = null) {
      if(!this.previewCtx) return;
      this.previewCtx.clearRect(0,0,this.grid.offsetWidth,this.grid.offsetHeight);
      if (this.currentPolygonPoints.length > 0) {
          this.previewCtx.save();
          this.previewCtx.setLineDash([8,6]);
          this.previewCtx.strokeStyle = this.selectedColor.hex;
          this.previewCtx.lineWidth = this.strokeWidth; 
          this.previewCtx.beginPath();
          this.previewCtx.moveTo(this.currentPolygonPoints[0].x, this.currentPolygonPoints[0].y);
          for(let i=1; i<this.currentPolygonPoints.length; i++) this.previewCtx.lineTo(this.currentPolygonPoints[i].x, this.currentPolygonPoints[i].y);
          if (hoverPoint) this.previewCtx.lineTo(hoverPoint.x, hoverPoint.y); 
          this.previewCtx.stroke();
          this.previewCtx.restore();
      }
      for(const p of this.currentPolygonPoints) this._drawMarker(p.x, p.y, this.selectedColor.hex, false);
      if(hoverPoint) this._drawMarker(hoverPoint.x, hoverPoint.y, this.selectedColor.hex, false);
  }

  _drawPreviewArc(center, radiusVal, startAngle, endAngle, filled = false, ccw = false){
    if(!this.previewCtx || !center) return;
    this.previewCtx.clearRect(0,0,this.grid.offsetWidth,this.grid.offsetHeight);
    this._drawMarker(center.x, center.y, this.selectedColor.hex, false);
    
    this.previewCtx.save();
    this.previewCtx.setLineDash([8,6]);
    this.previewCtx.strokeStyle = this.selectedColor.hex;
    this.previewCtx.lineWidth = this.strokeWidth; 
    this.previewCtx.beginPath();
    
    if (filled) {
        this.previewCtx.moveTo(center.x, center.y);
        this.previewCtx.arc(center.x, center.y, radiusVal, startAngle, endAngle, ccw);
        this.previewCtx.closePath();
    } else {
        this.previewCtx.arc(center.x, center.y, radiusVal, startAngle, endAngle, ccw);
    }
    
    this.previewCtx.stroke();
    this.previewCtx.restore();
  }

  _drawMarker(x,y,color, clearFirst=true){
    if(!this.previewCtx) return;
    if (clearFirst) this.previewCtx.clearRect(0,0,this.grid.offsetWidth,this.grid.offsetHeight);
    this.previewCtx.save();
    this.previewCtx.beginPath();
    this.previewCtx.fillStyle = color;
    this.previewCtx.arc(x, y, 4, 0, Math.PI*2);
    this.previewCtx.fill();
    this.previewCtx.restore();
  }

  _clearPreview(){
    if(!this.previewCtx) return;
    this.previewCtx.clearRect(0,0,this.grid.offsetWidth,this.grid.offsetHeight);
  }

  _setTool(tool){ 
    this.tool = tool;
    if (tool !== 'move') {
        this.selectedShapes = []; 
    }
    this._redrawPermShapes();
  }

  _exportGridToPDF(){
      const { jsPDF } = window.jspdf;
      const gridElement = document.getElementById('main-grid');
      const gridContainer = document.querySelector('.grid-container');
      
      const dataElements = {
          titolo: document.getElementById('titolo').value || 'Senza Titolo',
          cognome: document.getElementById('cognome').value || 'Sconosciuto',
          nome: document.getElementById('nome').value || 'Sconosciuto',
          classe: document.getElementById('classe').value || 'Sconosciuta',
          data: document.getElementById('data').value || (new Date()).toLocaleDateString('it-IT')
      };
      
      const uploadedImage = document.getElementById('uploaded-image');
      const videoElement = document.getElementById('video-element');
      const iframeElement = document.getElementById('iframe-element');

      const isImageVisible = uploadedImage.style.display !== 'none' && uploadedImage.src;
      const isVideoVisible = (videoElement.style.display !== 'none' && videoElement.src) || (iframeElement.style.display !== 'none' && iframeElement.src);

      const coordTop = document.getElementById('coord-top');
      const coordLeft = document.getElementById('coord-left');
      if (coordTop) coordTop.style.display = 'none';
      if (coordLeft) coordLeft.style.display = 'none';

      const originalGridBg = gridElement.style.backgroundColor;
      gridElement.style.backgroundColor = 'white'; 
      const originalContainerBorder = gridContainer.style.border;
      gridContainer.style.border = 'none';
      const originalContainerPadding = gridContainer.style.padding;
      gridContainer.style.padding = '0'; 

      html2canvas(gridElement, {
          scale: 3,
          logging: false,
          useCORS: true,
          ignoreElements: (element) => element.id === 'line-preview' 
      }).then(canvas => {
          gridElement.style.backgroundColor = originalGridBg;
          gridContainer.style.border = originalContainerBorder; 
          gridContainer.style.padding = originalContainerPadding;
          if (coordTop) {
              coordTop.style.display = this.isCartesian ? 'block' : 'grid';
          }
          if (coordLeft) {
              coordLeft.style.display = this.isCartesian ? 'block' : 'grid';
          }
          
          const imgData = canvas.toDataURL('image/png');

          const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const marginX = 15;
          let currentY = 15;
          
          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'bold');
          pdf.text(dataElements.titolo, pdfWidth / 2, currentY, { align: 'center' });
          currentY += 8; 
          
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
          pdf.text("DISEGNO GEOMETRICO SU GRIGLIA", pdfWidth / 2, currentY, { align: 'center' });
          currentY += 4;
          
          const imgProps = pdf.getImageProperties(imgData);
          const gridImgWidth = 180; 
          const gridImgHeight = (imgProps.height * gridImgWidth) / imgProps.width;
          const gridXPos = marginX;
          
          pdf.addImage(imgData, 'PNG', gridXPos, currentY, gridImgWidth, gridImgHeight);
          currentY += gridImgHeight + 15; 
          
          const colWidth = 85; 
          const colGap = 10;
          const leftX = marginX;
          const rightX = leftX + colWidth + colGap;

          let maxColHeight = 0;
          let dataY = currentY; 
          
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.text("IMMAGINE DI SFONDO (RIFERIMENTO)", leftX, dataY);
          dataY += 5;
          
          if (isImageVisible) {
              try {
                  const imgSrc = uploadedImage.src;
                  const imgPropsSfondo = pdf.getImageProperties(imgSrc);
                  let sfondoImgWidth = colWidth / 1.5; 
                  let sfondoImgHeight = (imgPropsSfondo.height * sfondoImgWidth) / imgPropsSfondo.width;
                  const maxHeightLimit = 80; 
                  if (sfondoImgHeight > maxHeightLimit) {
                      sfondoImgHeight = maxHeightLimit;
                      sfondoImgWidth = (imgPropsSfondo.width * sfondoImgHeight) / imgPropsSfondo.height;
                  }
                  const imgYPos = dataY + 2;
                  pdf.addImage(imgSrc, imgPropsSfondo.fileType, leftX + (colWidth - sfondoImgWidth)/4, imgYPos, sfondoImgWidth, sfondoImgHeight);
                  maxColHeight = Math.max(maxColHeight, sfondoImgHeight + 5);
              } catch (e) {
                  pdf.setFont('helvetica', 'italic');
                  pdf.setTextColor(150, 50, 50); 
                  pdf.text("Errore nel caricamento dell'immagine di sfondo.", leftX, dataY + 10);
                  pdf.setTextColor(0, 0, 0); 
                  maxColHeight = Math.max(maxColHeight, 20); 
              }
          } else if (isVideoVisible) {
              pdf.setFont('helvetica', 'italic');
              pdf.text("Video caricato come riferimento (non stampabile).", leftX, dataY + 10);
              maxColHeight = Math.max(maxColHeight, 20);
          } else {
              pdf.setFont('helvetica', 'italic');
              pdf.text("Nessuna immagine o video importato.", leftX, dataY + 10);
              maxColHeight = Math.max(maxColHeight, 20);
          }

          let dataYRight = currentY;
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.text("DATI INTESTATI", rightX, dataYRight);
          dataYRight += 5;
          
          const drawDataLine = (label, value) => {
              pdf.setFont('helvetica', 'bold');
              pdf.text(`${label}:`, rightX, dataYRight);
              pdf.setFont('helvetica', 'normal');
              pdf.text(value, rightX + 18, dataYRight); 
              dataYRight += 5;
          };

          drawDataLine('Cognome', dataElements.cognome);
          drawDataLine('Nome', dataElements.nome);
          drawDataLine('Classe', dataElements.classe);
          drawDataLine('Data', dataElements.data);
          
          maxColHeight = Math.max(maxColHeight, dataYRight - currentY); 
          currentY += maxColHeight + 10;
          
          pdf.setFontSize(8);
          pdf.text(`SimpleGrid - Caridi Nicola ©`, pdfWidth / 2, pdfHeight - 10, { align: 'center' });
          pdf.save(`GridArt_${dataElements.titolo.replace(/[^a-z0-9]/gi, '_')}.pdf`);
      }).catch(error => {
          gridElement.style.backgroundColor = originalGridBg;
          gridContainer.style.border = originalContainerBorder; 
          gridContainer.style.padding = originalContainerPadding;
          if (coordTop) {
              coordTop.style.display = this.isCartesian ? 'block' : 'grid';
          }
          if (coordLeft) {
              coordLeft.style.display = this.isCartesian ? 'block' : 'grid';
          }
          alert('Errore durante l\'esportazione PDF. Dettagli: ' + error.message);
      });
  }
}

window.addEventListener('DOMContentLoaded', ()=>{ window.fixGrid = new FixGrid(); });