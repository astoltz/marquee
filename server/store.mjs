// Store — in-memory state persistence
//
// Stores sequences, global config, and schedule.
// Persists to server/data.json on changes.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data.json');

export class Store {
  constructor() {
    this.data = {
      sequences: {},       // name -> { steps, options }
      activeSequence: null, // name of the active sequence
      globalConfig: {},     // global config overrides
      schedule: [],         // schedule entries
    };
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        Object.assign(this.data, parsed);
      }
    } catch (e) {
      console.warn('Store: Failed to load data.json:', e.message);
    }
  }

  _save() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.warn('Store: Failed to save data.json:', e.message);
    }
  }

  // --- Sequences ---

  getSequences() {
    return this.data.sequences;
  }

  getSequence(name) {
    return this.data.sequences[name] || null;
  }

  setSequence(name, sequence) {
    this.data.sequences[name] = sequence;
    this._save();
  }

  deleteSequence(name) {
    delete this.data.sequences[name];
    if (this.data.activeSequence === name) {
      this.data.activeSequence = null;
    }
    this._save();
  }

  getActiveSequence() {
    if (!this.data.activeSequence) return null;
    return this.data.sequences[this.data.activeSequence] || null;
  }

  setActiveSequence(name) {
    this.data.activeSequence = name;
    this._save();
  }

  // --- Global Config ---

  getGlobalConfig() {
    return this.data.globalConfig;
  }

  setGlobalConfig(config) {
    Object.assign(this.data.globalConfig, config);
    this._save();
  }

  // --- Schedule ---

  getSchedule() {
    return this.data.schedule;
  }

  addScheduleEntry(entry) {
    entry.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    this.data.schedule.push(entry);
    this._save();
    return entry;
  }

  removeScheduleEntry(id) {
    this.data.schedule = this.data.schedule.filter(e => e.id !== id);
    this._save();
  }

  // Full state export
  toJSON() {
    return this.data;
  }
}
