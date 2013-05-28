import ui.View as View;
import ui.TextView as TextView;
import ui.ImageView as ImageView;
import ui.resource.Image as Image;

import .item.ItemView as ItemView;

import .tiles.TileGroups as TileGroups;

import .ViewPool;
import .SelectedItemView;
import .ParticleSystemView;

var cursorYes = new Image({url: 'resources/images/cursorYes.png'});
var cursorNo = new Image({url: 'resources/images/cursorNo.png'});

exports = Class(View, function (supr) {
	this.init = function (opts) {
		opts = merge(
			opts,
			{
				x: 0,
				y: 0,
				width: GC.app.baseWidth,
				height: GC.app.baseHeight
			}
		);

		supr(this, 'init', [opts]);

		this._grid = null;
		this._gridX = null;
		this._gridY = null;
		this._gridWidth = null;
		this._gridHeight = null;

		this._tileWidth = opts.tileWidth;
		this._tileHeight = opts.tileHeight;

		this._needsBuild = true;
		this._hasSelection = false;

		this._itemSettings = opts.itemSettings;
		this._tileGroups = new TileGroups(opts);
		this._sizes = {};
		for (var i = 0; i < opts.tileSettings.length; i++) {
			var tileSetting = opts.tileSettings[i];
			this._sizes[tileSetting.group] = tileSetting;
		}

		this._tileViews = [];
		this._tilesOnScreen = {};
		this._currentPopulation = 0;

		this._minScale = opts.minScale || 0.6;
		this._maxScale = opts.maxScale || 2;

		this._gridSettings = opts.gridSettings;

		this._particleSettings = opts.particleSettings;
		this._particleSystems = {};

		this.style.scale = 1;
	};

	this._createLayer = function (data, layer) {
		var tileViews = this._tileViews;
		var maxCountX = this._maxCountX;
		var maxCountY = this._maxCountY;
		var layerIndex = this._layers.length;
		var layerView = {
				container: new View({
					superview: this,
					x: 0,
					y: 0,
					width: maxCountX * this._tileWidth,
					height: maxCountY * this._tileHeight,
					blockEvents: layer.blockEvents
				}),
				tileViews: []
			};

		if (layer.dynamicViews) {
			layerView.viewPool = new ViewPool({
				initCount: layer.dynamicViews,
				ctor: ItemView,
				initOpts: {
					superview: layerView.container,
					itemSettings: this._itemSettings,
					particleSettings: this._particleSettings
				}
			});
		}

		if (layer.particleSystems) {
			layerView.particleSystems = new ViewPool({
				initCount: layer.dynamicViews,
				ctor: ParticleSystemView,
				initOpts: {
					superview: layerView.container,
					particleSettings: this._particleSettings,
					particleSystemsCB: function () { return layerView.particleSystems; },
					particleSystemSize: layer.particleSystemSize,
					tileWidth: this._tileWidth,
					tileHeight: this._tileHeight
				}
			});
		}

		for (y = 0; y < maxCountY; y++) {
			if (!tileViews[y]) {
				tileViews[y] = [];
			}

			var offsetX = (y & 1) * this._tileWidth * 0.5;
			var line = [];

			for (x = 0; x < maxCountX; x++) {
				if (!tileViews[y][x]) {
					tileViews[y][x] = [];
				}
				var view = new ImageView({
						superview: layerView.container,
						x: offsetX + x * this._tileWidth,
						y: y * this._tileHeight * 0.5,
						zIndex: (y * maxCountX + x) * 100,
						width: this._tileWidth,
						height: this._tileHeight,
						visible: false
					});

				tileViews[y][x][layerIndex] = view;

				view.startX = view.style.x;
				view.startY = view.style.y;
				view.startZ = (y * maxCountX + x) * 100;
				view.left = offsetX + x * this._tileWidth;
				view.bottom = y * this._tileHeight * 0.5 + this._tileHeight;
				line.push(view);

				if (!layer.blockEvents) {
					(bind(this, function (x, y, view) {
						view.gridTile = null;
						view.onInputStart = bind(this, function (evt) {
							evt.cancel();
							view.gridTile.model && this.onSelectItem(view, view.gridTile);
						});
					}))(x, y, view);
				}
			}

			layerView.tileViews.push(line);
		}

		return layerView;
	};

	this._populateTiles = function (data) {
		var tilesOnScreen = this._tilesOnScreen;
		var length = this._layers.length;
		var gridWidth = data.gridWidth;
		var gridHeight = data.gridHeight;
		var countX = this._countX;
		var countY = this._countY;
		var offsetZ = (this._maxCountX * this._maxCountY) * 100;
		var gridX = data.gridX;
		var gridY = data.gridY;
		var grid = data.grid;
		var tiles = data.tiles;
		var sizes = this._sizes;

		this._currentPopulation++;
		var currentPopulation = this._currentPopulation;
		var tileGroups = this._tileGroups;

		for (y = 0; y < countY; y++) {
			var a = ~~(y * 0.5);
			var b = gridWidth - a;
			var c = y + gridHeight - a;

			var tileViewLine = this._tileViews[y];

			for (x = 0; x < countX; x++) {
				var d = (gridX + x + b) % gridWidth;
				var e = (gridY + x + c) % gridHeight;

				var tileViewTile = tileViewLine[x];
				var tileView = tileViewTile[0];
				var tileOnScreen = tilesOnScreen[d + '_' + e];

				if (tileOnScreen) {
					tileOnScreen.currentPopulation = currentPopulation;
					tileOnScreen.x = tileView.startX;
					tileOnScreen.y = tileView.startY;
					tileOnScreen.z = tileView.startZ + offsetZ;
				} else {
					tilesOnScreen[d + '_' + e] = {
						currentPopulation: currentPopulation,
						x: tileView.startX,
						y: tileView.startY,
						z: tileView.startZ + offsetZ
					}
				}

				var gridTile = grid[e][d];
				var i = length;

				while (i) {
					i--;
					var tileView = tileViewTile[i];
					var style = tileView.style;
					var tile = gridTile[i];

					if ((tile.index === -1) || (tile.group >= 10000)) {
						style.visible = false;
					} else {
						var size = sizes[tile.group];

						style.width = size.width;
						style.height = size.height;
						style.x = tileView.left + size.x;
						style.y = tileView.bottom - size.height + size.y;
						style.zIndex = tileView.startZ + size.z[0] * offsetZ + size.z[1];
						style.visible = true;

						tileView.gridTile = gridTile;

						tileGroups.setImage(tileView, tile);
					}
				}
			}
		}

		this._grid = grid;
		this._gridX = gridX;
		this._gridY = gridY;
		this._gridWidth = gridWidth;
		this._gridHeight = gridHeight;

		this.emit('Populated');
	};

	this._buildWater = function () {
		this._maxCountX = (this.style.width / (this._tileWidth * this._minScale) + 3) | 0;
		this._maxCountY = (this.style.height / (this._tileHeight * this._minScale) * 2 + 7) | 0;

		var totalX = this._maxCountX * this._tileWidth;
		var totalY = this._maxCountY * this._tileHeight;

		this._waterView = new View({
			superview: this,
			x: 0,
			y: 0,
			width: totalX,
			height: totalY
		});
		var sizeY = Math.ceil(totalX / 3);
		var sizeX = Math.ceil(totalY / 3);

		this._waterSegments = [];		
		for (var y = 0; y < 3; y++) {
			for (var x = 0; x < 3; x++) {
				var waterSegment = new ImageView({
					superview: this._waterView,
					x: x * sizeX,
					y: y * sizeY,
					width: sizeX,
					height: sizeY,
					backgroundColor: 'rgb(0,120,255)'
					//image: 'resources/images/water/water_0001.png'
				});
				this._waterSegments.push(waterSegment);
			}
		}
	};

	this._buildView = function (data) {
		this._buildWater();

		this._maxCountX = (this.style.width / (this._tileWidth * this._minScale) + 3) | 0;
		this._maxCountY = (this.style.height / (this._tileHeight * this._minScale) * 2 + 7) | 0;

		this._countX = (this.style.width / (this._tileWidth * this.style.scale) + 3) | 0;
		this._countY = (this.style.height / (this._tileHeight * this.style.scale) * 2 + 7) | 0;

		this._layers = [];

		var layers = this._gridSettings.layers;
		for (var i = 0; i < layers.length; i++) {
			this._layers.push(this._createLayer(data, layers[i]));
		}

		this._needsBuild = false;

		this._selection = new ViewPool({
			initCount: 100,
			ctor: ImageView,
			tag: 'Selection',
			initOpts: {
				superview: this._layers[0].container,
				image: cursorYes
			}
		});

		this._deltaX = this._tileWidth * 0.5;
		this._deltaY = this._tileHeight * 0.5;

		this._selectedItem = new SelectedItemView({superview: this});

		console.log('Tiles per view:', this._maxCountY * this._maxCountX);
	};

	this.gridToPoint = function (data, grid) {
		var gridX = grid.x;
		var gridY = grid.y;
		var minX = -this._tileWidth;
		var maxX = (this._countY + 1) * this._tileWidth;
		var minY = -this._tileHeight;
		var maxY = (this._countX + 1) * this._tileHeight;
		var w = this._tileWidth * 0.5;
		var h = this._tileHeight * 0.5;

		for (i = -1; i < 2; i++) {
			for (j = -1; j < 2; j++) {
				var x = -data.gridX + gridX + i * data.gridWidth;
				var y = -data.gridY + gridY + j * data.gridHeight;
				var a = (x * w) + (y * w) - this._tileWidth * 2 + data.offsetX;
				var b = (y * h) - (x * h) - this._tileHeight * 2 + data.offsetY;

				if ((a >= minX) && (a <= maxX) && (b >= minY) && (b <= maxY)) {
					return {x: a, y: b};
				}
			}
		}

		return false;
	};

	this._showSelection = function (data) {
		var startPoint = data.selection.startPoint;
		var endPoint = data.selection.endPoint;
		var minX = Math.min(startPoint.x, endPoint.x);
		var maxX = Math.max(startPoint.x, endPoint.x);
		var minY = Math.min(startPoint.y, endPoint.y);
		var maxY = Math.max(startPoint.y, endPoint.y);

		if (maxX - minX > data.gridWidth * 0.5) {
			var m = maxX;
			maxX = minX;
			minX = m - data.gridWidth;
		}
		if (maxY - minY > data.gridHeight * 0.5) {
			var m = maxY;
			maxY = minY;
			minY = m - data.gridHeight;
		}

		var selection = this._selection;
		var views = selection.getViews();
		var count = 0;
		var image = data.selection.accept ? cursorYes : cursorNo;
		for (y = minY; y <= maxY; y++) {
			for (x = minX; x <= maxX; x++) {
				var point = this.gridToPoint(data, {x: x, y: y});
				if (point) {
					if (selection.getLength() <= count) {
						selection.obtainView();
					}
					var view = views[count];
					view.setImage(image);
					view.style.width = this._tileWidth;
					view.style.height = this._tileHeight;
					view.style.x = point.x - this._offsetX;
					view.style.y = point.y - this._offsetY;
					view.style.zIndex = 999999;
					view.style.visible = true;
					count++;
				}
			}
		}

		while (selection.getLength() > count) {
			selection.releaseView(views[selection.getLength() - 1]);
		}
	};

	this.onInputStart = function (evt) {
		if (this._selectedItem.style.visible) {
			this.emit('UnselectItem');
			this._selectedItem.style.visible = false;
		}
	};

	this.onSelectItem = function (view, gridTile) {
		this.emit('SelectItem', view, gridTile);
		this._selectedItem.setView(view, this._offsetX, this._offsetY);
	};

	this.onUpdate = function (data) {
		this._needsBuild && this._buildView(data);

		if ((this._gridX !== data.gridX) || (this._gridY !== data.gridY)) {
			this._populateTiles(data);
		}

		var offsetX = -this._tileWidth * 2 + data.offsetX;
		var offsetY = -this._tileHeight * 2 + data.offsetY;

		if ((this._offsetX !== offsetX) || (this._offsetY !== offsetY)) {
			var i = this._layers.length;

			while (i) {
				var layer = this._layers[--i];
				layer.container.style.x = offsetX;
				layer.container.style.y = offsetY;
			}

			this._waterView.style.x = offsetX;
			this._waterView.style.y = offsetY;

			this._offsetX = offsetX;
			this._offsetY = offsetY;

			var tilesOnScreen = this._tilesOnScreen;
			var particleSystems = this._particleSystems;
			var currentPopulation = this._currentPopulation;

			for (var index in particleSystems) {
				var tileOnScreen = tilesOnScreen[index];
				var particleSystem = particleSystems[index];

				if (tileOnScreen.currentPopulation === currentPopulation) {
					var style = particleSystem.style;

					style.x = tileOnScreen.x;
					style.y = tileOnScreen.y;
					style.zIndex = tileOnScreen.z + 50;
				} else {
					particleSystem.release();
				}
			}
		}

		if (data.selection) {
			this._hasSelection = true;
			this._showSelection(data);
		} else if (this._hasSelection) {
			this._hasSelection = false;
			this._selection.releaseAllViews();
		}
	};

	this.tick = function (dt) {
		var layers = this._layers;

		if (!layers) {
			return;
		}

		var i = layers.length;

		while (i) {
			var layer = layers[--i];
			var particleSystems = layer.particleSystems;
			if (particleSystems) {
				var j = particleSystems.getLength();
				var views = particleSystems.getViews();
				while (j) {
					views[--j].update(dt);
				}
			}
		}
	};

	this.onRefreshMap = function (x, y) {
		if ((x === undefined) && (y === undefined)) {
			this._gridX = null;
		} else {
			var tileOnScreen = this._tilesOnScreen[x + '_' + y];
			if (tileOnScreen) {
				var tile = this._grid[y][x];
				var tileViews = tileViews[y][x];
				for (var i = 0; i < this._layers.length; i++) {
					var tileView = tileViews[i].tileViews[y][x];

					if (tile[i].index === -1) {
						tileView.visible = false;
					} else {
						tileView.setImage(this._tileGroups.getImage(tile[i]));
						tileView.visible = true;
					}
				}
			}
		}
	};

	this.onAddParticles = function (type, tileX, tileY, x, y) {
		var index = tileX + '_' + tileY;
		var tileOnScreen = this._tilesOnScreen[index];
		var particleSystems = this._particleSystems;

		if (tileOnScreen) {
			if (tileOnScreen.currentPopulation === this._currentPopulation) {
				var particleSystem = tileOnScreen.particleSystem;
				if (!particleSystem) {
					particleSystem = this._layers[1].particleSystems.obtainView()

					particleSystem.onRelease = function () {
						delete particleSystems[index];
						tileOnScreen.particleSystem = false;
					};

					tileOnScreen.particleSystem = particleSystem;
					particleSystems[index] = particleSystem;

					var style = particleSystem.style;

					style.x = tileOnScreen.x;
					style.y = tileOnScreen.y;
					style.zIndex = tileOnScreen.z + 50;
				}

				particleSystem.addParticle('hit', x, y);
			} else if (tileOnScreen.particleSystem) {
				tileOnScreen.particleSystem.release();
				tileOnScreen.particleSystem = false;
			}
		}
	};

	this.getViewPool = function (layer) {
		return this._layers[layer] ? this._layers[layer].viewPool : false;
	};

	this.getScale = function () {
		return this.style.scale;
	};

	this.setScale = function (scale) {
		if (scale < this._minScale) {
			scale = this._minScale;
		} else if (scale > this._maxScale) {
			scale = this._maxScale;
		}
		if (scale === this.style.scale) {
			return;
		}

		var startWidth = this.style.width / this.style.scale;
		var startHeight = this.style.height / this.style.scale;

		this.style.scale = scale;

		var endWidth = this.style.width / scale;
		var endHeight = this.style.height / scale;

		var countX = this._countX;
		var countY = this._countY;

		this._countX = (this.style.width / (this._tileWidth * scale) + 3) | 0;
		this._countY = (this.style.height / (this._tileHeight * scale) * 2 + 7) | 0;

		for (var i = 0; i < this._layers.length; i++) {
			var tileViews = this._layers[i].tileViews;
			for (y = countY; y < this._countY; y++) {
				var line = tileViews[y];
				for (x = countX; x < this._countX; x++) {
					line[x].style.visible = false;
				}
			}
		}

		this._gridX = null;

		var dir = (this.style.scale > scale) ? -0.5 : 0.5;
		this.emit('ChangeOffset', (endWidth - startWidth) * dir, (endHeight - startHeight) * dir);
	};

	this.getTileWidth = function () {
		return this._tileWidth;
	};

	this.hideSelectedItem = function () {
		this._selectedItem.style.visible = false;
	};
});