// Copyright 2019 Google LLC
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

function checkType(name, type, value) {
  if (typeof value != type) throw TypeError(name + ' must be a ' + type);
  return value;
}

function setItem(array, index, value) {
  if (index < 0 || index >= array.length) throw Error('index out of bounds');
  if (value !== null && !value._type) {
    throw TypeError('value must be a sass type');
  }
  array[index] = value;
}

function SassBoolean(value) {
  if (new.target) throw Error('Cannot instantiate SassBoolean');
  return checkType('value', 'boolean', value)
    ? SassBoolean.TRUE
    : SassBoolean.FALSE;
}
SassBoolean.prototype.getValue = function() {
  return this._value;
};
SassBoolean.TRUE = Object.assign(Object.create(SassBoolean.prototype), {
  _type: 'boolean',
  _value: true,
});
SassBoolean.FALSE = Object.assign(Object.create(SassBoolean.prototype), {
  _type: 'boolean',
  _value: false,
});

function SassNumber(value = 0, unit = '') {
  if (!new.target) return new SassNumber(value, unit);
  this._type = 'number';
  this.setValue(value);
  this.setUnit(unit);
}
SassNumber.prototype.setValue = function(v) {
  this._value = checkType('value', 'number', v);
};
SassNumber.prototype.getValue = function() {
  return this._value;
};
SassNumber.prototype.setUnit = function(v) {
  this._unit = checkType('unit', 'string', v);
};
SassNumber.prototype.getUnit = function() {
  return this._unit;
};

function SassColor(r = undefined, g = undefined, b = undefined, a = undefined) {
  if (!new.target) return new SassColor(r, g, b, a);
  if (
    r === undefined &&
    g === undefined &&
    b === undefined &&
    a === undefined
  ) {
    r = g = b = 0;
    a = 1;
  } else if (
    r !== undefined &&
    g === undefined &&
    b === undefined &&
    a === undefined
  ) {
    const argb = checkType('argb', 'number', r);
    a = ((argb >> 0o30) & 0xff) / 0xff;
    r = (argb >> 0o20) & 0xff;
    g = (argb >> 0o10) & 0xff;
    b = (argb >> 0o00) & 0xff;
  } else if (
    r !== undefined &&
    g !== undefined &&
    b !== undefined &&
    a === undefined
  ) {
    a = 1;
  } else if (
    r !== undefined &&
    g !== undefined &&
    b !== undefined &&
    a !== undefined
  ) {
  } else {
    throw Error('Color should be constructed with 0, 1, 3 or 4 arguments');
  }
  this._type = 'color';
  this.setR(r);
  this.setG(g);
  this.setB(b);
  this.setA(a);
}
SassColor.prototype.setR = function(v) {
  this._r = checkType('r', 'number', v);
};
SassColor.prototype.getR = function(v) {
  return this._r;
};
SassColor.prototype.setG = function(v) {
  this._g = checkType('g', 'number', v);
};
SassColor.prototype.getG = function(v) {
  return this._g;
};
SassColor.prototype.setB = function(v) {
  this._b = checkType('b', 'number', v);
};
SassColor.prototype.getB = function(v) {
  return this._b;
};
SassColor.prototype.setA = function(v) {
  this._a = checkType('a', 'number', v);
};
SassColor.prototype.getA = function(v) {
  return this._a;
};

function SassString(value = '') {
  if (!new.target) return new SassString(value);
  this._type = 'string';
  this.setValue(value);
  this.setQuoted(false);
}
SassString.prototype.setValue = function(v) {
  this._value = checkType('value', 'string', v);
};
SassString.prototype.getValue = function() {
  return this._value;
};
SassString.prototype.setQuoted = function(v) {
  this._quoted = checkType('quoted', 'boolean', v);
};
SassString.prototype.getQuoted = function() {
  return this._quoted;
};

function SassList(length = 0, commaSeparator = true) {
  if (!new.target) return new SassList(length, commaSeparator);
  checkType('length', 'number', length);
  this._type = 'list';
  this._values = [];
  for (let i = 0; i < length; i++) this._values[i] = null;
  this.setSeparator(commaSeparator);
  this.setIsBracketed(false);
}
SassList.prototype.setValue = function(i, v) {
  setItem(this._values, i, v);
};
SassList.prototype.getValue = function(i) {
  return this._values[i];
};
SassList.prototype.setSeparator = function(v) {
  this._separator = checkType('separator', 'boolean', v);
};
SassList.prototype.getSeparator = function() {
  return this._separator;
};
SassList.prototype.setIsBracketed = function(v) {
  this._isBracketed = checkType('isBracketed', 'boolean', v);
};
SassList.prototype.getIsBracketed = function() {
  return this._isBracketed;
};
SassList.prototype.getLength = function() {
  return this._values.length;
};

function SassMap(length = 0) {
  if (!new.target) return new SassMap(length);
  checkType('length', 'number', length);
  this._type = 'map';
  this._keys = [];
  this._values = [];
  for (let i = 0; i < length; i++) this._keys[i] = this._values[i] = null;
}
SassMap.prototype.setKey = function(i, v) {
  setItem(this._keys, i, v);
};
SassMap.prototype.getKey = function(i) {
  return this._keys[i];
};
SassMap.prototype.setValue = function(i, v) {
  setItem(this._values, i, v);
};
SassMap.prototype.getValue = function(i) {
  return this._values[i];
};
SassMap.prototype.getLength = function() {
  return this._values.length;
};

function SassError(message = '') {
  if (!new.target) return new SassError(message);
  this._type = 'error';
  this._message = checkType('message', 'string', message);
}

function SassWarning(message = '') {
  if (!new.target) return new SassWarning(message);
  this._type = 'warning';
  this._message = checkType('message', 'string', message);
}

function SassNull() {
  if (new.target) throw Error('Cannot instantiate SassNull');
  return SassNull.NULL;
}
SassNull.prototype.toJSON = function() {
  return null;
};
SassNull.NULL = Object.create(SassNull.prototype);

const typeMap = {};
exports.Boolean = typeMap.boolean = SassBoolean;
exports.Number = typeMap.number = SassNumber;
exports.Color = typeMap.color = SassColor;
exports.String = typeMap.string = SassString;
exports.List = typeMap.list = SassList;
exports.Map = typeMap.map = SassMap;
exports.Error = typeMap.error = SassError;
exports.Warning = typeMap.warning = SassWarning;
exports.Null = SassNull;

function revive(value) {
  if (value === null) return SassNull.NULL;
  if (typeof value != 'object') throw TypeError('Sass value is not an object');
  const type = value._type;
  if (!typeMap[type]) throw TypeError('Invalid _type');

  if (type == 'boolean') {
    return value._value ? SassBoolean.TRUE : SassBoolean.FALSE;
  }

  const result = Object.assign(Object.create(typeMap[type].prototype), value);
  if (result._keys) result._keys = result._keys.map(revive);
  if (result._values) result._values = result._values.map(revive);
  return result;
}

exports.revive = revive;
