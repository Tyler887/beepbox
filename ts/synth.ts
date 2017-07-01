/*
Copyright (C) 2012 John Nesky

Permission is hereby granted, free of charge, to any person obtaining a copy of 
this software and associated documentation files (the "Software"), to deal in 
the Software without restriction, including without limitation the rights to 
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies 
of the Software, and to permit persons to whom the Software is furnished to do 
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all 
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE 
SOFTWARE.
*/

interface Window {
	AudioContext: any;
	webkitAudioContext: any;
	mozAudioContext: any;
	oAudioContext: any;
	msAudioContext: any;
}

module beepbox {
	interface Dictionary<T> {
		[K: string]: T;
	}
	
	class BitFieldReader {
		private _bits: boolean[] = [];
		private _readIndex: number = 0;
		
		constructor(base64CharToInt: Readonly<Dictionary<number>>, source: string) {
			for (let i: number = 0; i < source.length; i++) {
				const value: number = base64CharToInt[source.charAt(i)];
				this._bits.push((value & 0x20) != 0);
				this._bits.push((value & 0x10) != 0);
				this._bits.push((value & 0x08) != 0);
				this._bits.push((value & 0x04) != 0);
				this._bits.push((value & 0x02) != 0);
				this._bits.push((value & 0x01) != 0);
			}
		}
		
		public read(bitCount: number): number {
			let result: number = 0;
			while (bitCount > 0) {
				result = result << 1;
				result += this._bits[this._readIndex++] ? 1 : 0;
				bitCount--;
			}
			return result;
		}
		
		public readLongTail(minValue: number, minBits: number): number {
			let result: number = minValue;
			let numBits: number = minBits;
			while (this._bits[this._readIndex++]) {
				result += 1 << numBits;
				numBits++;
			}
			while (numBits > 0) {
				numBits--;
				if (this._bits[this._readIndex++]) {
					result += 1 << numBits;
				}
			}
			return result;
		}
		
		public readPartDuration(): number {
			return this.readLongTail(1, 2);
		}
		
		public readPinCount(): number {
			return this.readLongTail(1, 0);
		}
		
		public readNoteInterval(): number {
			if (this.read(1)) {
				return -this.readLongTail(1, 3);
			} else {
				return this.readLongTail(1, 3);
			}
		}
	}
	
	class BitFieldWriter {
		private _bits: boolean[] = [];
		
		public write(bitCount: number, value: number): void {
			bitCount--;
			while (bitCount >= 0) {
				this._bits.push(((value >> bitCount) & 1) == 1);
				bitCount--;
			}
		}
		
		public writeLongTail(minValue: number, minBits: number, value: number): void {
			if (value < minValue) throw new Error("value out of bounds");
			value -= minValue;
			let numBits: number = minBits;
			while (value >= (1 << numBits)) {
				this._bits.push(true);
				value -= 1 << numBits;
				numBits++;
			}
			this._bits.push(false);
			while (numBits > 0) {
				numBits--;
				this._bits.push((value & (1 << numBits)) != 0);
			}
		}
		
		public writePartDuration(value: number): void {
			this.writeLongTail(1, 2, value);
		}
		
		public writePinCount(value: number): void {
			this.writeLongTail(1, 0, value);
		}
		
		public writeNoteInterval(value: number): void {
			if (value < 0) {
				this.write(1, 1); // sign
				this.writeLongTail(1, 3, -value);
			} else {
				this.write(1, 0); // sign
				this.writeLongTail(1, 3, value);
			}
		}
		
		public concat(other: BitFieldWriter): void {
			this._bits = this._bits.concat(other._bits);
		}
		
		public encodeBase64(base64IntToChar: ReadonlyArray<string>): string {
			let result: string = "";
			for (let i: number = 0; i < this._bits.length; i += 6) {
				let value: number = 0;
				if (this._bits[i+0]) value += 0x20;
				if (this._bits[i+1]) value += 0x10;
				if (this._bits[i+2]) value += 0x08;
				if (this._bits[i+3]) value += 0x04;
				if (this._bits[i+4]) value += 0x02;
				if (this._bits[i+5]) value += 0x01;
				result += base64IntToChar[value];
			}
			return result;
		}
	}

	export class Music {
		public static readonly scaleNames: ReadonlyArray<string> = ["easy :)", "easy :(", "island :)", "island :(", "blues :)", "blues :(", "normal :)", "normal :(", "romani :)", "romani :(", "enigma", "expert"];
		public static readonly scaleFlags: ReadonlyArray<ReadonlyArray<boolean>> = [
			[ true, false,  true, false,  true, false, false,  true, false,  true, false, false],
			[ true, false, false,  true, false,  true, false,  true, false, false,  true, false],
			[ true, false, false, false,  true,  true, false,  true, false, false, false,  true],
			[ true,  true, false,  true, false, false, false,  true,  true, false, false, false],
			[ true, false,  true,  true,  true, false, false,  true, false,  true, false, false],
			[ true, false, false,  true, false,  true,  true,  true, false, false,  true, false],
			[ true, false,  true, false,  true,  true, false,  true, false,  true, false,  true],
			[ true, false,  true,  true, false,  true, false,  true,  true, false,  true, false],
			[ true,  true, false, false,  true,  true, false,  true,  true, false,  true, false],
			[ true, false,  true,  true, false, false,  true,  true,  true, false, false,  true],
			[ true, false,  true, false,  true, false,  true, false,  true, false,  true, false],
			[ true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true],
		];
		public static readonly pianoScaleFlags: ReadonlyArray<boolean> = [ true, false,  true, false,  true,  true, false,  true, false,  true, false,  true];
		// C1 has index 24 on the MIDI scale. C8 is 108, and C9 is 120. C10 is barely in the audible range.
		public static readonly blackKeyNameParents: ReadonlyArray<number> = [-1, 1, -1, 1, -1, 1, -1, -1, 1, -1, 1, -1];
		public static readonly noteNames: ReadonlyArray<string> = ["C", null, "D", null, "E", "F", null, "G", null, "A", null, "B"];
		public static readonly keyNames: ReadonlyArray<string> = ["B", "A♯", "A", "G♯", "G", "F♯", "F", "E", "D♯", "D", "C♯", "C"];
		public static readonly keyTransposes: ReadonlyArray<number> = [23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12];
		public static readonly tempoNames: ReadonlyArray<string> = ["molasses", "slow", "leisurely", "moderate", "steady", "brisk", "hasty", "fast", "strenuous", "grueling", "hyper", "ludicrous"];
		public static readonly reverbRange: number = 4;
		public static readonly beatsMin: number = 3;
		public static readonly beatsMax: number = 15;
		public static readonly barsMin: number = 1;
		public static readonly barsMax: number = 128;
		public static readonly patternsMin: number = 1;
		public static readonly patternsMax: number = 64;
		public static readonly instrumentsMin: number = 1;
		public static readonly instrumentsMax: number = 10;
		public static readonly partNames: ReadonlyArray<string> = ["triples", "standard"];
		public static readonly partCounts: ReadonlyArray<number> = [3, 4];
		public static readonly waveNames: ReadonlyArray<string> = ["triangle", "square", "pulse wide", "pulse narrow", "sawtooth", "double saw", "double pulse", "spiky", "plateau"];
		public static readonly waveVolumes: ReadonlyArray<number> = [1.0, 0.5, 0.5, 0.5, 0.65, 0.5, 0.4, 0.4, 0.94];
		public static readonly drumNames: ReadonlyArray<string> = ["retro", "white"];
		public static readonly drumVolumes: ReadonlyArray<number> = [0.25, 1.0];
		public static readonly filterNames: ReadonlyArray<string> = ["sustain sharp", "sustain medium", "sustain soft", "decay sharp", "decay medium", "decay soft"];
		public static readonly filterBases: ReadonlyArray<number> = [2.0, 3.5, 5.0, 1.0, 2.5, 4.0];
		public static readonly filterDecays: ReadonlyArray<number> = [0.0, 0.0, 0.0, 10.0, 7.0, 4.0];
		public static readonly filterVolumes: ReadonlyArray<number> = [0.4, 0.7, 1.0, 0.5, 0.75, 1.0];
		public static readonly attackNames: ReadonlyArray<string> = ["binary", "sudden", "smooth", "slide"];
		public static readonly effectNames: ReadonlyArray<string> = ["none", "vibrato light", "vibrato delayed", "vibrato heavy", "tremelo light", "tremelo heavy"];
		public static readonly effectVibratos: ReadonlyArray<number> = [0.0, 0.15, 0.3, 0.45, 0.0, 0.0];
		public static readonly effectTremelos: ReadonlyArray<number> = [0.0, 0.0, 0.0, 0.0, 0.25, 0.5];
		public static readonly chorusNames: ReadonlyArray<string> = ["union", "shimmer", "hum", "honky tonk", "dissonant", "fifths", "octaves", "bowed"];
		public static readonly chorusValues: ReadonlyArray<number> = [0.0, 0.02, 0.05, 0.1, 0.25, 3.5, 6, 0.02];
		public static readonly chorusOffsets: ReadonlyArray<number> = [0.0, 0.0, 0.0, 0.0, 0.0, 3.5, 6, 0.0];
		public static readonly chorusVolumes: ReadonlyArray<number> = [0.7, 0.8, 1.0, 1.0, 0.9, 0.9, 0.8, 1.0];
		public static readonly volumeNames: ReadonlyArray<string> = ["loudest", "loud", "medium", "quiet", "quietest", "mute"];
		public static readonly volumeValues: ReadonlyArray<number> = [0.0, 0.5, 1.0, 1.5, 2.0, -1.0];
		public static readonly channelVolumes: ReadonlyArray<number> = [0.27, 0.27, 0.27, 0.19];
		public static readonly drumInterval: number = 6;
		public static readonly numChannels: number = 4;
		public static readonly drumCount: number = 12;
		public static readonly noteCount: number = 37;
		public static readonly maxPitch: number = 84;
	}

	export class TonePin {
		public interval: number;
		public time: number;
		public volume: number;
		
		constructor(interval: number, time: number, volume: number) {
			this.interval = interval;
			this.time = time;
			this.volume = volume;
		}
	}

	export class Tone {
		public notes: number[];
		public pins: TonePin[];
		public start: number;
		public end: number;
		
		constructor(note: number, start: number, end: number, volume: number, fadeout: boolean = false) {
			this.notes = [note];
			this.pins = [new TonePin(0, 0, volume), new TonePin(0, end - start, fadeout ? 0 : volume)];
			this.start = start;
			this.end = end;
		}
	}

	export class BarPattern {
		public tones: Tone[];
		public instrument: number;
		constructor() {
			this.tones = [];
			this.instrument = 0;
		}
		
		public cloneTones(): Tone[] {
			const result: Tone[] = [];
			for (const oldTone of this.tones) {
				const newTone: Tone = new Tone(-1, oldTone.start, oldTone.end, 3);
				newTone.notes = oldTone.notes.concat();
				newTone.pins = [];
				for (const oldPin of oldTone.pins) {
					newTone.pins.push(new TonePin(oldPin.interval, oldPin.time, oldPin.volume));
				}
				result.push(newTone);
			}
			return result;
		}
	}

	export class Song {
		private static readonly _oldestVersion: number = 2;
		private static readonly _latestVersion: number = 5;
		private static readonly _base64CharToInt: Readonly<Dictionary<number>> = {0:0,1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,a:10,b:11,c:12,d:13,e:14,f:15,g:16,h:17,i:18,j:19,k:20,l:21,m:22,n:23,o:24,p:25,q:26,r:27,s:28,t:29,u:30,v:31,w:32,x:33,y:34,z:35,A:36,B:37,C:38,D:39,E:40,F:41,G:42,H:43,I:44,J:45,K:46,L:47,M:48,N:49,O:50,P:51,Q:52,R:53,S:54,T:55,U:56,V:57,W:58,X:59,Y:60,Z:61,"-":62,".":62,_:63}; // 62 could be represented by either "-" or "." for historical reasons. New songs should use "-".
		private static readonly _base64IntToChar: ReadonlyArray<string> = ["0","1","2","3","4","5","6","7","8","9","a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","-","_"];
		
		public scale: number;
		public key: number;
		public tempo: number;
		public reverb: number;
		public beats: number;
		public bars: number;
		public patterns: number;
		public parts: number;
		public instruments: number;
		public loopStart: number;
		public loopLength: number;
		public channelPatterns: BarPattern[][];
		public channelBars: number[][];
		public channelOctaves: number[];
		public instrumentWaves: number[][];
		public instrumentFilters: number[][];
		public instrumentAttacks: number[][];
		public instrumentEffects: number[][];
		public instrumentChorus: number[][];
		public instrumentVolumes: number[][];
		
		constructor(string: string = null) {
			if (string != null) {
				this.fromString(string);
			} else {
				this.initToDefault();
			}
		}
		
		public initToDefault(): void {
			this.channelPatterns = [
				[new BarPattern(), new BarPattern(), new BarPattern(), new BarPattern(), new BarPattern(), new BarPattern(), new BarPattern(), new BarPattern()], 
				[new BarPattern(), new BarPattern(), new BarPattern(), new BarPattern(), new BarPattern(), new BarPattern(), new BarPattern(), new BarPattern()], 
				[new BarPattern(), new BarPattern(), new BarPattern(), new BarPattern(), new BarPattern(), new BarPattern(), new BarPattern(), new BarPattern()], 
				[new BarPattern(), new BarPattern(), new BarPattern(), new BarPattern(), new BarPattern(), new BarPattern(), new BarPattern(), new BarPattern()], 
			];
			this.channelBars = [
				[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
				[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
				[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
				[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
			];
			this.channelOctaves = [3,2,1,0];
			this.instrumentVolumes = [[0],[0],[0],[0]];
			this.instrumentWaves   = [[1],[1],[1],[1]];
			this.instrumentFilters = [[0],[0],[0],[0]];
			this.instrumentAttacks = [[1],[1],[1],[1]];
			this.instrumentEffects = [[0],[0],[0],[0]];
			this.instrumentChorus  = [[0],[0],[0],[0]];
			this.scale = 0;
			this.key = Music.keyNames.length - 1;
			this.loopStart = 0;
			this.loopLength = 4;
			this.tempo = 7;
			this.reverb = 0;
			this.beats = 8;
			this.bars = 16;
			this.patterns = 8;
			this.parts = 4;
			this.instruments = 1;
		}
		
		public toString(): string {
			let channel: number;
			let bits: BitFieldWriter;
			let result: string = "";
			const base64IntToChar: ReadonlyArray<string> = Song._base64IntToChar;
			
			result += base64IntToChar[Song._latestVersion];
			result += "s" + base64IntToChar[this.scale];
			result += "k" + base64IntToChar[this.key];
			result += "l" + base64IntToChar[this.loopStart >> 6] + base64IntToChar[this.loopStart & 0x3f];
			result += "e" + base64IntToChar[(this.loopLength - 1) >> 6] + base64IntToChar[(this.loopLength - 1) & 0x3f];
			result += "t" + base64IntToChar[this.tempo];
			result += "m" + base64IntToChar[this.reverb];
			result += "a" + base64IntToChar[this.beats - 1];
			result += "g" + base64IntToChar[(this.bars - 1) >> 6] + base64IntToChar[(this.bars - 1) & 0x3f];
			result += "j" + base64IntToChar[this.patterns - 1];
			result += "i" + base64IntToChar[this.instruments - 1];
			result += "r" + base64IntToChar[Music.partCounts.indexOf(this.parts)];
			
			result += "w";
			for (channel = 0; channel < Music.numChannels; channel++) for (let i: number = 0; i < this.instruments; i++) {
				result += base64IntToChar[this.instrumentWaves[channel][i]];
			}
			
			result += "f";
			for (channel = 0; channel < Music.numChannels; channel++) for (let i: number = 0; i < this.instruments; i++) {
				result += base64IntToChar[this.instrumentFilters[channel][i]];
			}
			
			result += "d";
			for (channel = 0; channel < Music.numChannels; channel++) for (let i: number = 0; i < this.instruments; i++) {
				result += base64IntToChar[this.instrumentAttacks[channel][i]];
			}
			
			result += "c";
			for (channel = 0; channel < Music.numChannels; channel++) for (let i: number = 0; i < this.instruments; i++) {
				result += base64IntToChar[this.instrumentEffects[channel][i]];
			}
			
			result += "h";
			for (channel = 0; channel < Music.numChannels; channel++) for (let i: number = 0; i < this.instruments; i++) {
				result += base64IntToChar[this.instrumentChorus[channel][i]];
			}
			
			result += "v";
			for (channel = 0; channel < Music.numChannels; channel++) for (let i: number = 0; i < this.instruments; i++) {
				result += base64IntToChar[this.instrumentVolumes[channel][i]];
			}
			
			result += "o";
			for (channel = 0; channel < Music.numChannels; channel++) {
				result += base64IntToChar[this.channelOctaves[channel]];
			}
			
			result += "b";
			bits = new BitFieldWriter();
			let neededBits: number = 0;
			while ((1 << neededBits) < this.patterns + 1) neededBits++;
			for (channel = 0; channel < Music.numChannels; channel++) for (let i: number = 0; i < this.bars; i++) {
				bits.write(neededBits, this.channelBars[channel][i]);
			}
			result += bits.encodeBase64(base64IntToChar);
			
			result += "p";
			bits = new BitFieldWriter();
			let neededInstrumentBits: number = 0;
			while ((1 << neededInstrumentBits) < this.instruments) neededInstrumentBits++;
			for (channel = 0; channel < Music.numChannels; channel++) {
				const octaveOffset: number = channel == 3 ? 0 : this.channelOctaves[channel] * 12;
				let lastNote: number = (channel == 3 ? 4 : 12) + octaveOffset;
				const recentNotes: number[] = channel == 3 ? [4,6,7,2,3,8,0,10] : [12, 19, 24, 31, 36, 7, 0];
				const recentShapes: string[] = [];
				for (let i: number = 0; i < recentNotes.length; i++) {
					recentNotes[i] += octaveOffset;
				}
				for (const p of this.channelPatterns[channel]) {
					bits.write(neededInstrumentBits, p.instrument);
					
					if (p.tones.length > 0) {
						bits.write(1, 1);
						
						let curPart: number = 0;
						for (const t of p.tones) {
							if (t.start > curPart) {
								bits.write(2, 0); // rest
								bits.writePartDuration(t.start - curPart);
							}
							
							const shapeBits: BitFieldWriter = new BitFieldWriter();
							
							// 0: 1 note, 10: 2 notes, 110: 3 notes, 111: 4 notes
							for (let i: number = 1; i < t.notes.length; i++) shapeBits.write(1,1);
							if (t.notes.length < 4) shapeBits.write(1,0);
							
							shapeBits.writePinCount(t.pins.length - 1);
							
							shapeBits.write(2, t.pins[0].volume); // volume
							
							let shapePart: number = 0;
							let startNote: number = t.notes[0];
							let currentNote: number = startNote;
							const pitchBends: number[] = [];
							for (let i: number = 1; i < t.pins.length; i++) {
								const pin: TonePin = t.pins[i];
								const nextNote: number = startNote + pin.interval;
								if (currentNote != nextNote) {
									shapeBits.write(1, 1);
									pitchBends.push(nextNote);
									currentNote = nextNote;
								} else {
									shapeBits.write(1, 0);
								}
								shapeBits.writePartDuration(pin.time - shapePart);
								shapePart = pin.time;
								shapeBits.write(2, pin.volume);
							}
							
							const shapeString: string = shapeBits.encodeBase64(base64IntToChar);
							const shapeIndex: number = recentShapes.indexOf(shapeString);
							if (shapeIndex == -1) {
								bits.write(2, 1); // new shape
								bits.concat(shapeBits);
							} else {
								bits.write(1, 1); // old shape
								bits.writeLongTail(0, 0, shapeIndex);
								recentShapes.splice(shapeIndex, 1);
							}
							recentShapes.unshift(shapeString);
							if (recentShapes.length > 10) recentShapes.pop();
							
							const allNotes: number[] = t.notes.concat(pitchBends);
							for (let i: number = 0; i < allNotes.length; i++) {
								const note: number = allNotes[i];
								const noteIndex: number = recentNotes.indexOf(note);
								if (noteIndex == -1) {
									let interval: number = 0;
									let noteIter: number = lastNote;
									if (noteIter < note) {
										while (noteIter != note) {
											noteIter++;
											if (recentNotes.indexOf(noteIter) == -1) interval++;
										}
									} else {
										while (noteIter != note) {
											noteIter--;
											if (recentNotes.indexOf(noteIter) == -1) interval--;
										}
									}
									bits.write(1, 0);
									bits.writeNoteInterval(interval);
								} else {
									bits.write(1, 1);
									bits.write(3, noteIndex);
									recentNotes.splice(noteIndex, 1);
								}
								recentNotes.unshift(note);
								if (recentNotes.length > 8) recentNotes.pop();
								
								if (i == t.notes.length - 1) {
									lastNote = t.notes[0];
								} else {
									lastNote = note;
								}
							}
							curPart = t.end;
						}
						
						if (curPart < this.beats * this.parts) {
							bits.write(2, 0); // rest
							bits.writePartDuration(this.beats * this.parts - curPart);
						}
					} else {
						bits.write(1, 0);
					}
				}
			}
			const bitString: string = bits.encodeBase64(base64IntToChar);
			let stringLength: number = bitString.length;
			let digits: string = "";
			while (stringLength > 0) {
				digits = base64IntToChar[stringLength & 0x3f] + digits;
				stringLength = stringLength >> 6;
			}
			result += base64IntToChar[digits.length];
			result += digits;
			result += bitString;
			
			return result;
		}
		
		public fromString(compressed: string): void {
			compressed = compressed.trim();
			if (compressed.charAt(0) == "#") compressed = compressed.substring(1);
			if (compressed == null || compressed.length == 0) {
				this.initToDefault();
				return;
			}
			if (compressed.charAt(0) == "{") {
				this.fromJsonObject(JSON.parse(compressed));
				return;
			}
			this.initToDefault();
			let charIndex: number = 0;
			const version: number = Song._base64CharToInt[compressed.charAt(charIndex++)];
			if (version == -1 || version > Song._latestVersion || version < Song._oldestVersion) return;
			const beforeThree: boolean = version < 3;
			const beforeFour:  boolean = version < 4;
			const beforeFive:  boolean = version < 5;
			const base64CharToInt: Readonly<Dictionary<number>> = Song._base64CharToInt; // beforeThree ? Song._oldBase64 : Song._newBase64;
			if (beforeThree) this.instrumentAttacks = [[0],[0],[0],[0]];
			if (beforeThree) this.instrumentWaves   = [[1],[1],[1],[0]];
			while (charIndex < compressed.length) {
				const command: string = compressed.charAt(charIndex++);
				let channel: number;
				if (command == "s") {
					this.scale = base64CharToInt[compressed.charAt(charIndex++)];
					if (beforeThree && this.scale == 10) this.scale = 11;
				} else if (command == "k") {
					this.key = base64CharToInt[compressed.charAt(charIndex++)];
				} else if (command == "l") {
					if (beforeFive) {
						this.loopStart = base64CharToInt[compressed.charAt(charIndex++)];
					} else {
						this.loopStart = (base64CharToInt[compressed.charAt(charIndex++)] << 6) + base64CharToInt[compressed.charAt(charIndex++)];
					}
				} else if (command == "e") {
					if (beforeFive) {
						this.loopLength = base64CharToInt[compressed.charAt(charIndex++)];
					} else {
						this.loopLength = (base64CharToInt[compressed.charAt(charIndex++)] << 6) + base64CharToInt[compressed.charAt(charIndex++)] + 1;
					}
				} else if (command == "t") {
					if (beforeFour) {
						this.tempo = [1, 4, 7, 10][base64CharToInt[compressed.charAt(charIndex++)]];
					} else {
						this.tempo = base64CharToInt[compressed.charAt(charIndex++)];
					}
					this.tempo = this._clip(0, Music.tempoNames.length, this.tempo);
				} else if (command == "m") {
					this.reverb = base64CharToInt[compressed.charAt(charIndex++)];
					this.reverb = this._clip(0, Music.reverbRange, this.reverb);
				} else if (command == "a") {
					if (beforeThree) {
						this.beats = [6, 7, 8, 9, 10][base64CharToInt[compressed.charAt(charIndex++)]];
					} else {
						this.beats = base64CharToInt[compressed.charAt(charIndex++)] + 1;
					}
					this.beats = Math.max(Music.beatsMin, Math.min(Music.beatsMax, this.beats));
				} else if (command == "g") {
					this.bars = (base64CharToInt[compressed.charAt(charIndex++)] << 6) + base64CharToInt[compressed.charAt(charIndex++)] + 1;
					this.bars = Math.max(Music.barsMin, Math.min(Music.barsMax, this.bars));
				} else if (command == "j") {
					this.patterns = base64CharToInt[compressed.charAt(charIndex++)] + 1;
					this.patterns = Math.max(Music.patternsMin, Math.min(Music.patternsMax, this.patterns));
				} else if (command == "i") {
					this.instruments = base64CharToInt[compressed.charAt(charIndex++)] + 1;
					this.instruments = Math.max(Music.instrumentsMin, Math.min(Music.instrumentsMax, this.instruments));
				} else if (command == "r") {
					this.parts = Music.partCounts[base64CharToInt[compressed.charAt(charIndex++)]];
				} else if (command == "w") {
					if (beforeThree) {
						channel = base64CharToInt[compressed.charAt(charIndex++)];
						this.instrumentWaves[channel][0] = this._clip(0, Music.waveNames.length, base64CharToInt[compressed.charAt(charIndex++)]);
					} else {
						for (channel = 0; channel < Music.numChannels; channel++) {
							for (let i: number = 0; i < this.instruments; i++) {
								this.instrumentWaves[channel][i] = this._clip(0, Music.waveNames.length, base64CharToInt[compressed.charAt(charIndex++)]);
							}
						}
					}
				} else if (command == "f") {
					if (beforeThree) {
						channel = base64CharToInt[compressed.charAt(charIndex++)];
						this.instrumentFilters[channel][0] = [0, 2, 3, 5][this._clip(0, Music.filterNames.length, base64CharToInt[compressed.charAt(charIndex++)])];
					} else {
						for (channel = 0; channel < Music.numChannels; channel++) {
							for (let i: number = 0; i < this.instruments; i++) {
								this.instrumentFilters[channel][i] = this._clip(0, Music.filterNames.length, base64CharToInt[compressed.charAt(charIndex++)]);
							}
						}
					}
				} else if (command == "d") {
					if (beforeThree) {
						channel = base64CharToInt[compressed.charAt(charIndex++)];
						this.instrumentAttacks[channel][0] = this._clip(0, Music.attackNames.length, base64CharToInt[compressed.charAt(charIndex++)]);
					} else {
						for (channel = 0; channel < Music.numChannels; channel++) {
							for (let i: number = 0; i < this.instruments; i++) {
								this.instrumentAttacks[channel][i] = this._clip(0, Music.attackNames.length, base64CharToInt[compressed.charAt(charIndex++)]);
							}
						}
					}
				} else if (command == "c") {
					if (beforeThree) {
						channel = base64CharToInt[compressed.charAt(charIndex++)];
						this.instrumentEffects[channel][0] = this._clip(0, Music.effectNames.length, base64CharToInt[compressed.charAt(charIndex++)]);
						if (this.instrumentEffects[channel][0] == 1) this.instrumentEffects[channel][0] = 3;
						else if (this.instrumentEffects[channel][0] == 3) this.instrumentEffects[channel][0] = 5;
					} else {
						for (channel = 0; channel < Music.numChannels; channel++) {
							for (let i: number = 0; i < this.instruments; i++) {
								this.instrumentEffects[channel][i] = this._clip(0, Music.effectNames.length, base64CharToInt[compressed.charAt(charIndex++)]);
							}
						}
					}
				} else if (command == "h") {
					if (beforeThree) {
						channel = base64CharToInt[compressed.charAt(charIndex++)];
						this.instrumentChorus[channel][0] = this._clip(0, Music.chorusNames.length, base64CharToInt[compressed.charAt(charIndex++)]);
					} else {
						for (channel = 0; channel < Music.numChannels; channel++) {
							for (let i: number = 0; i < this.instruments; i++) {
								this.instrumentChorus[channel][i] = this._clip(0, Music.chorusNames.length, base64CharToInt[compressed.charAt(charIndex++)]);
							}
						}
					}
				} else if (command == "v") {
					if (beforeThree) {
						channel = base64CharToInt[compressed.charAt(charIndex++)];
						this.instrumentVolumes[channel][0] = this._clip(0, Music.volumeNames.length, base64CharToInt[compressed.charAt(charIndex++)]);
					} else {
						for (channel = 0; channel < Music.numChannels; channel++) {
							for (let i: number = 0; i < this.instruments; i++) {
								this.instrumentVolumes[channel][i] = this._clip(0, Music.volumeNames.length, base64CharToInt[compressed.charAt(charIndex++)]);
							}
						}
					}
				} else if (command == "o") {
					if (beforeThree) {
						channel = base64CharToInt[compressed.charAt(charIndex++)];
						this.channelOctaves[channel] = this._clip(0, 5, base64CharToInt[compressed.charAt(charIndex++)]);
					} else {
						for (channel = 0; channel < Music.numChannels; channel++) {
							this.channelOctaves[channel] = this._clip(0, 5, base64CharToInt[compressed.charAt(charIndex++)]);
						}
					}
				} else if (command == "b") {
					let subStringLength: number;
					if (beforeThree) {
						channel = base64CharToInt[compressed.charAt(charIndex++)];
						const barCount: number = base64CharToInt[compressed.charAt(charIndex++)];
						subStringLength = Math.ceil(barCount * 0.5);
						const bits: BitFieldReader = new BitFieldReader(base64CharToInt, compressed.substr(charIndex, subStringLength));
						for (let i: number = 0; i < barCount; i++) {
							this.channelBars[channel][i] = bits.read(3) + 1;
						}
					} else if (beforeFive) {
						let neededBits: number = 0;
						while ((1 << neededBits) < this.patterns) neededBits++;
						subStringLength = Math.ceil(Music.numChannels * this.bars * neededBits / 6);
						const bits: BitFieldReader = new BitFieldReader(base64CharToInt, compressed.substr(charIndex, subStringLength));
						for (channel = 0; channel < Music.numChannels; channel++) {
							this.channelBars[channel].length = this.bars;
							for (let i: number = 0; i < this.bars; i++) {
								this.channelBars[channel][i] = bits.read(neededBits) + 1;
							}
						}
					} else {
						let neededBits2: number = 0;
						while ((1 << neededBits2) < this.patterns + 1) neededBits2++;
						subStringLength = Math.ceil(Music.numChannels * this.bars * neededBits2 / 6);
						const bits: BitFieldReader = new BitFieldReader(base64CharToInt, compressed.substr(charIndex, subStringLength));
						for (channel = 0; channel < Music.numChannels; channel++) {
							this.channelBars[channel].length = this.bars;
							for (let i: number = 0; i < this.bars; i++) {
								this.channelBars[channel][i] = bits.read(neededBits2);
							}
						}
					}
					charIndex += subStringLength;
				} else if (command == "p") {
					let bitStringLength: number = 0;
					if (beforeThree) {
						channel = base64CharToInt[compressed.charAt(charIndex++)];
						
						// The old format used the next character to represent the number of patterns in the channel, which is usually eight, the default. 
						charIndex++; //let patternCount: number = base64CharToInt[compressed.charAt(charIndex++)];
						
						bitStringLength = base64CharToInt[compressed.charAt(charIndex++)];
						bitStringLength = bitStringLength << 6;
						bitStringLength += base64CharToInt[compressed.charAt(charIndex++)];
					} else {
						channel = 0;
						let bitStringLengthLength: number = base64CharToInt[compressed.charAt(charIndex++)];
						while (bitStringLengthLength > 0) {
							bitStringLength = bitStringLength << 6;
							bitStringLength += base64CharToInt[compressed.charAt(charIndex++)];
							bitStringLengthLength--;
						}
					}
					
					const bits: BitFieldReader = new BitFieldReader(base64CharToInt, compressed.substr(charIndex, bitStringLength));
					charIndex += bitStringLength;
					
					let neededInstrumentBits: number = 0;
					while ((1 << neededInstrumentBits) < this.instruments) neededInstrumentBits++;
					while (true) {
						this.channelPatterns[channel] = [];
						
						const octaveOffset: number = channel == 3 ? 0 : this.channelOctaves[channel] * 12;
						let tone: Tone = null;
						let pin: TonePin = null;
						let lastNote: number = (channel == 3 ? 4 : 12) + octaveOffset;
						const recentNotes: number[] = channel == 3 ? [4,6,7,2,3,8,0,10] : [12, 19, 24, 31, 36, 7, 0];
						const recentShapes: any[] = [];
						for (let i: number = 0; i < recentNotes.length; i++) {
							recentNotes[i] += octaveOffset;
						}
						for (let i: number = 0; i < this.patterns; i++) {
							const newPattern: BarPattern | null = new BarPattern();
							newPattern.instrument = bits.read(neededInstrumentBits);
							this.channelPatterns[channel][i] = newPattern;
							
							if (!beforeThree && bits.read(1) == 0) continue;
							
							let curPart: number = 0;
							const newTones: Tone[] = [];
							while (curPart < this.beats * this.parts) {
								
								const useOldShape: boolean = bits.read(1) == 1;
								let newTone: boolean = false;
								let shapeIndex: number = 0;
								if (useOldShape) {
									shapeIndex = bits.readLongTail(0, 0);
								} else {
									newTone = bits.read(1) == 1;
								}
								
								if (!useOldShape && !newTone) {
									const restLength: number = bits.readPartDuration();
									curPart += restLength;
								} else {
									let shape: any;
									let pinObj: any;
									let note: number;
									if (useOldShape) {
										shape = recentShapes[shapeIndex];
										recentShapes.splice(shapeIndex, 1);
									} else {
										shape = {};
										
										shape.noteCount = 1;
										while (shape.noteCount < 4 && bits.read(1) == 1) shape.noteCount++;
										
										shape.pinCount = bits.readPinCount();
										shape.initialVolume = bits.read(2);
										
										shape.pins = [];
										shape.length = 0;
										shape.bendCount = 0;
										for (let j: number = 0; j < shape.pinCount; j++) {
											pinObj = {};
											pinObj.pitchBend = bits.read(1) == 1;
											if (pinObj.pitchBend) shape.bendCount++;
											shape.length += bits.readPartDuration();
											pinObj.time = shape.length;
											pinObj.volume = bits.read(2);
											shape.pins.push(pinObj);
										}
									}
									recentShapes.unshift(shape);
									if (recentShapes.length > 10) recentShapes.pop();
									
									tone = new Tone(0,curPart,curPart + shape.length, shape.initialVolume);
									tone.notes = [];
									tone.pins.length = 1;
									const pitchBends: number[] = [];
									for (let j: number = 0; j < shape.noteCount + shape.bendCount; j++) {
										const useOldNote: boolean = bits.read(1) == 1;
										if (!useOldNote) {
											const interval: number = bits.readNoteInterval();
											note = lastNote;
											let intervalIter: number = interval;
											while (intervalIter > 0) {
												note++;
												while (recentNotes.indexOf(note) != -1) note++;
												intervalIter--;
											}
											while (intervalIter < 0) {
												note--;
												while (recentNotes.indexOf(note) != -1) note--;
												intervalIter++;
											}
										} else {
											const noteIndex: number = bits.read(3);
											note = recentNotes[noteIndex];
											recentNotes.splice(noteIndex, 1);
										}
										
										recentNotes.unshift(note);
										if (recentNotes.length > 8) recentNotes.pop();
										
										if (j < shape.noteCount) {
											tone.notes.push(note);
										} else {
											pitchBends.push(note);
										}
										
										if (j == shape.noteCount - 1) {
											lastNote = tone.notes[0];
										} else {
											lastNote = note;
										}
									}
									
									pitchBends.unshift(tone.notes[0]);
									
									for (const pinObj of shape.pins) {
										if (pinObj.pitchBend) pitchBends.shift();
										pin = new TonePin(pitchBends[0] - tone.notes[0], pinObj.time, pinObj.volume);
										tone.pins.push(pin);
									}
									curPart = tone.end;
									newTones.push(tone);
								}
							}
							newPattern.tones = newTones;
						} // for (let i: number = 0; i < patterns; i++) {
						
						if (beforeThree) {
							break;
						} else {
							channel++;
							if (channel >= Music.numChannels) break;
						}
					} // while (true)
				}
			}
		}
		
		public toJsonObject(enableIntro: boolean = true, loopCount: number = 1, enableOutro: boolean = true): Object {
			const channelArray: Object[] = [];
			for (let channel: number = 0; channel < Music.numChannels; channel++) {
				const instrumentArray: Object[] = [];
				for (let i: number = 0; i < this.instruments; i++) {
					if (channel == 3) {
						instrumentArray.push({
							volume: (5 - this.instrumentVolumes[channel][i]) * 20,
							wave: Music.drumNames[this.instrumentWaves[channel][i]],
							envelope: Music.attackNames[this.instrumentAttacks[channel][i]],
						});
					} else {
						instrumentArray.push({
							volume: (5 - this.instrumentVolumes[channel][i]) * 20,
							wave: Music.waveNames[this.instrumentWaves[channel][i]],
							envelope: Music.attackNames[this.instrumentAttacks[channel][i]],
							filter: Music.filterNames[this.instrumentFilters[channel][i]],
							chorus: Music.chorusNames[this.instrumentChorus[channel][i]],
							effect: Music.effectNames[this.instrumentEffects[channel][i]],
						});
					}
				}
				
				const patternArray: Object[] = [];
				for (const pattern of this.channelPatterns[channel]) {
					const noteArray: Object[] = [];
					for (const tone of pattern.tones) {
						const pointArray: Object[] = [];
						for (const pin of tone.pins) {
							pointArray.push({
								tick: pin.time + tone.start,
								pitchBend: pin.interval,
								volume: Math.round(pin.volume * 100 / 3),
							});
						}
						
						noteArray.push({
							pitches: tone.notes,
							points: pointArray,
						});
					}
					
					patternArray.push({
						instrument: pattern.instrument + 1,
						notes: noteArray, 
					});
				}
				
				const sequenceArray: number[] = [];
				if (enableIntro) for (let i: number = 0; i < this.loopStart; i++) {
					sequenceArray.push(this.channelBars[channel][i]);
				}
				for (let l: number = 0; l < loopCount; l++) for (let i: number = this.loopStart; i < this.loopStart + this.loopLength; i++) {
					sequenceArray.push(this.channelBars[channel][i]);
				}
				if (enableOutro) for (let i: number = this.loopStart + this.loopLength; i < this.bars; i++) {
					sequenceArray.push(this.channelBars[channel][i]);
				}
				
				channelArray.push({
					octaveScrollBar: this.channelOctaves[channel],
					instruments: instrumentArray,
					patterns: patternArray,
					sequence: sequenceArray,
				});
			}
			
			return {
				version: Song._latestVersion,
				scale: Music.scaleNames[this.scale],
				key: Music.keyNames[this.key],
				introBars: this.loopStart,
				loopBars: this.loopLength,
				beatsPerBar: this.beats,
				ticksPerBeat: this.parts,
				beatsPerMinute: this.getBeatsPerMinute(), // represents tempo
				reverb: this.reverb,
				//outroBars: this.bars - this.loopStart - this.loopLength; // derive this from bar arrays?
				//patternCount: this.patterns, // derive this from pattern arrays?
				//instrumentsPerChannel: this.instruments, //derive this from instrument arrays?
				channels: channelArray,
			};
		}
		
		public fromJsonObject(jsonObject: any): void {
			this.initToDefault();
			if (!jsonObject) return;
			const version: any = jsonObject.version;
			if (version !== 5) return;
			
			this.scale = 11; // default to expert.
			if (jsonObject.scale != undefined) {
				const scale: number = Music.scaleNames.indexOf(jsonObject.scale);
				if (scale != -1) this.scale = scale;
			}
			
			if (jsonObject.key != undefined) {
				if (typeof(jsonObject.key) == "number") {
					this.key = Music.keyNames.length - 1 - (((jsonObject.key + 1200) >>> 0) % Music.keyNames.length);
				} else if (typeof(jsonObject.key) == "string") {
					const key: string = jsonObject.key;
					const letter: string = key.charAt(0).toUpperCase();
					const symbol: string = key.charAt(1).toLowerCase();
					const letterMap: Readonly<Dictionary<number>> = {"C": 11, "D": 9, "E": 7, "F": 6, "G": 4, "A": 2, "B": 0};
					const accidentalMap: Readonly<Dictionary<number>> = {"#": -1, "♯": -1, "b": 1, "♭": 1};
					let index: number | undefined = letterMap[letter];
					const offset: number | undefined = accidentalMap[symbol];
					if (index != undefined) {
						if (offset != undefined) index += offset;
						if (index < 0) index += 12;
						index = index % 12;
						this.key = index;
					}
				}
			}
			
			if (jsonObject.beatsPerMinute != undefined) {
				const bpm: number = jsonObject.beatsPerMinute | 0;
				this.tempo = Math.round(4.0 + 9.0 * Math.log(bpm / 120) / Math.LN2);
				this.tempo = this._clip(0, Music.tempoNames.length, this.tempo);
			}
			
			if (jsonObject.reverb != undefined) {
				this.reverb = this._clip(0, Music.reverbRange, jsonObject.reverb | 0);
			}
			
			if (jsonObject.beatsPerBar != undefined) {
				this.beats = Math.max(Music.beatsMin, Math.min(Music.beatsMax, jsonObject.beatsPerBar | 0));
			}
			
			if (jsonObject.ticksPerBeat != undefined) {
				this.parts = Math.max(3, Math.min(4, jsonObject.ticksPerBeat | 0));
			}
			
			let maxInstruments: number = 1;
			let maxPatterns: number = 1;
			let maxBars: number = 1;
			for (let channel: number = 0; channel < Music.numChannels; channel++) {
				if (jsonObject.channels && jsonObject.channels[channel]) {
					const channelObject: any = jsonObject.channels[channel];
					if (channelObject.instruments) maxInstruments = Math.max(maxInstruments, channelObject.instruments.length | 0);
					if (channelObject.patterns) maxPatterns = Math.max(maxPatterns, channelObject.patterns.length | 0);
					if (channelObject.sequence) maxBars = Math.max(maxBars, channelObject.sequence.length | 0);
				}
			}
			
			this.instruments = maxInstruments;
			this.patterns = maxPatterns;
			this.bars = maxBars;
			
			if (jsonObject.introBars != undefined) {
				this.loopStart = this._clip(0, this.bars, jsonObject.introBars | 0);
			}
			if (jsonObject.loopBars != undefined) {
				this.loopLength = this._clip(1, this.bars - this.loopStart + 1, jsonObject.loopBars | 0);
			}
			
			for (let channel: number = 0; channel < Music.numChannels; channel++) {
				let channelObject: any = undefined;
				if (jsonObject.channels) channelObject = jsonObject.channels[channel];
				if (channelObject == undefined) channelObject = {};
				
				if (channelObject.octaveScrollBar != undefined) {
					this.channelOctaves[channel] = this._clip(0, 5, channelObject.octaveScrollBar | 0);
				}
				
				this.instrumentVolumes[channel].length = this.instruments;
				this.instrumentWaves[channel].length = this.instruments;
				this.instrumentAttacks[channel].length = this.instruments;
				this.instrumentFilters[channel].length = this.instruments;
				this.instrumentChorus[channel].length = this.instruments;
				this.instrumentEffects[channel].length = this.instruments;
				this.channelPatterns[channel].length = this.patterns;
				this.channelBars[channel].length = this.bars;
				
				for (let i: number = 0; i < this.instruments; i++) {
					let instrumentObject: any = undefined;
					if (channelObject.instruments) instrumentObject = channelObject.instruments[i];
					if (instrumentObject == undefined) instrumentObject = {};
					if (instrumentObject.volume != undefined) {
						this.instrumentVolumes[channel][i] = this._clip(0, Music.volumeNames.length, Math.round(5 - (instrumentObject.volume | 0) / 20));
					} else {
						this.instrumentVolumes[channel][i] = 0;
					}
					this.instrumentAttacks[channel][i] = Music.attackNames.indexOf(instrumentObject.envelope);
					if (this.instrumentAttacks[channel][i] == -1) this.instrumentAttacks[channel][i] = 1;
					if (channel == 3) {
						this.instrumentWaves[channel][i] = Music.drumNames.indexOf(instrumentObject.wave);
						if (this.instrumentWaves[channel][i] == -1) this.instrumentWaves[channel][i] = 0;
						this.instrumentFilters[channel][i] = 0;
						this.instrumentChorus[channel][i] = 0;
						this.instrumentEffects[channel][i] = 0;
					} else {
						this.instrumentWaves[channel][i] = Music.waveNames.indexOf(instrumentObject.wave);
						if (this.instrumentWaves[channel][i] == -1) this.instrumentWaves[channel][i] = 1;
						this.instrumentFilters[channel][i] = Music.filterNames.indexOf(instrumentObject.filter);
						if (this.instrumentFilters[channel][i] == -1) this.instrumentFilters[channel][i] = 0;
						this.instrumentChorus[channel][i] = Music.chorusNames.indexOf(instrumentObject.chorus);
						if (this.instrumentChorus[channel][i] == -1) this.instrumentChorus[channel][i] = 0;
						this.instrumentEffects[channel][i] = Music.effectNames.indexOf(instrumentObject.effect);
						if (this.instrumentEffects[channel][i] == -1) this.instrumentEffects[channel][i] = 0;
					}
				}
				
				for (let i: number = 0; i < this.patterns; i++) {
					const pattern: BarPattern = new BarPattern();
					this.channelPatterns[channel][i] = pattern;
					
					let patternObject: any = undefined;
					if (channelObject.patterns) patternObject = channelObject.patterns[i];
					if (patternObject == undefined) continue;
					
					pattern.instrument = this._clip(0, this.instruments, (patternObject.instrument | 0) - 1);
					
					if (patternObject.notes && patternObject.notes.length > 0) {
						const maxToneCount: number = Math.min(this.beats * this.parts, patternObject.notes.length >>> 0);
						
						///@TODO: Consider supporting notes specified in any timing order, sorting them and truncating as necessary. 
						let tickClock: number = 0;
						for (let j: number = 0; j < patternObject.notes.length; j++) {
							if (j >= maxToneCount) break;
							
							const noteObject = patternObject.notes[j];
							if (!noteObject || !noteObject.pitches || !(noteObject.pitches.length >= 1) || !noteObject.points || !(noteObject.points.length >= 2)) {
								continue;
							}
							
							const tone: Tone = new Tone(0, 0, 0, 0);
							tone.notes = [];
							tone.pins = [];
							
							for (let k: number = 0; k < noteObject.pitches.length; k++) {
								const pitch: number = noteObject.pitches[k] | 0;
								if (tone.notes.indexOf(pitch) != -1) continue;
								tone.notes.push(pitch);
								if (tone.notes.length >= 4) break;
							}
							if (tone.notes.length < 1) continue;
							
							let toneClock: number = tickClock;
							let startInterval: number = 0;
							for (let k: number = 0; k < noteObject.points.length; k++) {
								const pointObject: any = noteObject.points[k];
								if (pointObject == undefined || pointObject.tick == undefined) continue;
								const interval: number = (pointObject.pitchBend == undefined) ? 0 : (pointObject.pitchBend | 0);
								const time: number = pointObject.tick | 0;
								const volume: number = (pointObject.volume == undefined) ? 3 : Math.max(0, Math.min(3, Math.round((pointObject.volume | 0) * 3 / 100)));
								
								if (time > this.beats * this.parts) continue;
								if (tone.pins.length == 0) {
									if (time < toneClock) continue;
									tone.start = time;
									startInterval = interval;
								} else {
									if (time <= toneClock) continue;
								}
								toneClock = time;
								
								tone.pins.push(new TonePin(interval - startInterval, time - tone.start, volume));
							}
							if (tone.pins.length < 2) continue;
							
							tone.end = tone.pins[tone.pins.length - 1].time + tone.start;
							
							const maxPitch: number = channel == 3 ? Music.drumCount - 1 : Music.maxPitch;
							let lowestPitch: number = maxPitch;
							let highestPitch: number = 0;
							for (let k: number = 0; k < tone.notes.length; k++) {
								tone.notes[k] += startInterval;
								if (tone.notes[k] < 0 || tone.notes[k] > maxPitch) {
									tone.notes.splice(k, 1);
									k--;
								}
								if (tone.notes[k] < lowestPitch) lowestPitch = tone.notes[k];
								if (tone.notes[k] > highestPitch) highestPitch = tone.notes[k];
							}
							if (tone.notes.length < 1) continue;
							
							for (let k: number = 0; k < tone.pins.length; k++) {
								const pin: TonePin = tone.pins[k];
								if (pin.interval + lowestPitch < 0) pin.interval = -lowestPitch;
								if (pin.interval + highestPitch > maxPitch) pin.interval = maxPitch - highestPitch;
								if (k >= 2) {
									if (pin.interval == tone.pins[k-1].interval && 
									    pin.interval == tone.pins[k-2].interval && 
									    pin.volume == tone.pins[k-1].volume && 
									    pin.volume == tone.pins[k-2].volume)
									{
										tone.pins.splice(k-1, 1);
										k--;
									}    
								}
							}
							
							pattern.tones.push(tone);
							tickClock = tone.end;
						}
					}
				}
				
				for (let i: number = 0; i < this.bars; i++) {
					this.channelBars[channel][i] = channelObject.sequence ? Math.min(this.patterns, channelObject.sequence[i] >>> 0) : 0;
				}
			}
		}
		
		private _clip(min: number, max: number, val: number): number {
			max = max - 1;
			if (val <= max) {
				if (val >= min) return val;
				else return min;
			} else {
				return max;
			}
		}
		
		public getPattern(channel: number, bar: number): BarPattern | null {
			const patternIndex: number = this.channelBars[channel][bar];
			if (patternIndex == 0) return null;
			return this.channelPatterns[channel][patternIndex - 1];
		}
		
		public getPatternInstrument(channel: number, bar: number): number {
			const pattern: BarPattern | null = this.getPattern(channel, bar);
			return pattern == null ? 0 : pattern.instrument;
		}
		
		public getBeatsPerMinute(): number {
			return Math.round(120.0 * Math.pow(2.0, (-4.0 + this.tempo) / 9.0));
		}
	}

	export class Synth {
		public samplesPerSecond: number = 44100;
		private _effectDuration: number = 0.14;
		private _effectAngle: number = Math.PI * 2.0 / (this._effectDuration * this.samplesPerSecond);
		private _effectYMult: number = 2.0 * Math.cos( this._effectAngle );
		private _limitDecay: number = 1.0 / (2.0 * this.samplesPerSecond);
		
		private _waves: Float64Array[] = [
			new Float64Array([1.0/15.0, 3.0/15.0, 5.0/15.0, 7.0/15.0, 9.0/15.0, 11.0/15.0, 13.0/15.0, 15.0/15.0, 15.0/15.0, 13.0/15.0, 11.0/15.0, 9.0/15.0, 7.0/15.0, 5.0/15.0, 3.0/15.0, 1.0/15.0, -1.0/15.0, -3.0/15.0, -5.0/15.0, -7.0/15.0, -9.0/15.0, -11.0/15.0, -13.0/15.0, -15.0/15.0, -15.0/15.0, -13.0/15.0, -11.0/15.0, -9.0/15.0, -7.0/15.0, -5.0/15.0, -3.0/15.0, -1.0/15.0]),
			new Float64Array([1.0, -1.0]),
			new Float64Array([1.0, -1.0, -1.0, -1.0]),
			new Float64Array([1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
			new Float64Array([1.0/31.0, 3.0/31.0, 5.0/31.0, 7.0/31.0, 9.0/31.0, 11.0/31.0, 13.0/31.0, 15.0/31.0, 17.0/31.0, 19.0/31.0, 21.0/31.0, 23.0/31.0, 25.0/31.0, 27.0/31.0, 29.0/31.0, 31.0/31.0, -31.0/31.0, -29.0/31.0, -27.0/31.0, -25.0/31.0, -23.0/31.0, -21.0/31.0, -19.0/31.0, -17.0/31.0, -15.0/31.0, -13.0/31.0, -11.0/31.0, -9.0/31.0, -7.0/31.0, -5.0/31.0, -3.0/31.0, -1.0/31.0]),
			new Float64Array([0.0, -0.2, -0.4, -0.6, -0.8, -1.0, 1.0, -0.8, -0.6, -0.4, -0.2, 1.0, 0.8, 0.6, 0.4, 0.2, ]),
			new Float64Array([1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0]),
			new Float64Array([1.0, -1.0, 1.0, -1.0, 1.0, 0.0]),
			new Float64Array([0.0, 0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.95, 0.9, 0.85, 0.8, 0.7, 0.6, 0.5, 0.4, 0.2, 0.0, -0.2, -0.4, -0.5, -0.6, -0.7, -0.8, -0.85, -0.9, -0.95, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -0.95, -0.9, -0.85, -0.8, -0.7, -0.6, -0.5, -0.4, -0.2, ]),
		];
		private _drumWaves: Float32Array[] = [ new Float32Array(32767), new Float32Array(32767) ];
		
		public song: Song = null;
		public stutterPressed: boolean = false;
		public pianoPressed: boolean = false;
		public pianoNote: number = 0;
		public pianoChannel: number = 0;
		public enableIntro: boolean = true;
		public enableOutro: boolean = false;
		public loopCount: number = -1;
		public volume: number = 1.0;
		
		private _playhead: number = 0.0;
		private _bar: number = 0;
		private _beat: number = 0;
		private _part: number = 0;
		private _arpeggio: number = 0;
		private _arpeggioSamples: number = 0;
		private _paused: boolean = true;
		private _leadPeriodA: number = 0.0;
		private _leadPeriodB: number = 0.0;
		private _leadSample: number = 0.0;
		private _harmonyPeriodA: number = 0.0;
		private _harmonyPeriodB: number = 0.0;
		private _harmonySample: number = 0.0;
		private _bassPeriodA: number = 0.0;
		private _bassPeriodB: number = 0.0;
		private _bassSample: number = 0.0;
		private _drumPeriod: number = 0.0;
		private _drumSample: number = 0.0;
		private _drumSignal: number = 1.0;
		private _stillGoing: boolean = false;
		//private sound: Sound = new Sound();
		//private soundChannel: SoundChannel = null;
		//private timer: Timer = new Timer(200, 0);
		private _effectPeriod: number = 0.0;
		private _limit: number = 0.0;
		
		
		private _delayLine: Float32Array = new Float32Array(16384);
		private _delayPos: number = 0;
		private _delayFeedback0: number = 0.0;
		private _delayFeedback1: number = 0.0;
		private _delayFeedback2: number = 0.0;
		private _delayFeedback3: number = 0.0;
		
		
		private _audioCtx: any;
		private _scriptNode: any;
		
		public get playing(): boolean {
			return !this._paused;
		}
		
		public get playhead(): number {
			return this._playhead;
		}
		
		public set playhead(value: number) {
			if (this.song != null) {
				this._playhead = Math.max(0, Math.min(this.song.bars, value));
				var remainder: number = this._playhead;
				this._bar = Math.floor(remainder);
				remainder = this.song.beats * (remainder - this._bar);
				this._beat = Math.floor(remainder);
				remainder = this.song.parts * (remainder - this._beat);
				this._part = Math.floor(remainder);
				remainder = 4 * (remainder - this._part);
				this._arpeggio = Math.floor(remainder);
				var samplesPerArpeggio: number = this._getSamplesPerArpeggio();
				remainder = samplesPerArpeggio * (remainder - this._arpeggio);
				this._arpeggioSamples = Math.floor(samplesPerArpeggio - remainder);
				if (this._bar < this.song.loopStart) {
					this.enableIntro = true;
				}
				if (this._bar > this.song.loopStart + this.song.loopLength) {
					this.enableOutro = true;
				}
			}
		}
		
		public get totalSamples(): number {
			if (this.song == null) return 0;
			const samplesPerBar: number = this._getSamplesPerArpeggio() * 4 * this.song.parts * this.song.beats;
			let loopMinCount: number = this.loopCount;
			if (loopMinCount < 0) loopMinCount = 1;
			let bars: number = this.song.loopLength * loopMinCount;
			if (this.enableIntro) bars += this.song.loopStart;
			if (this.enableOutro) bars += this.song.bars - (this.song.loopStart + this.song.loopLength);
			return bars * samplesPerBar;
		}
		
		public get totalSeconds(): number {
			return this.totalSamples / this.samplesPerSecond;
		}
		
		public get totalBars(): number {
			if (this.song == null) return 0.0;
			return this.song.bars;
		}
		
		constructor(song: any = null) {
			for (const wave of this._waves) {
				//wave.fixed = true;
				let sum: number = 0.0;
				for (let i: number = 0; i < wave.length; i++) sum += wave[i];
				const average: number = sum / wave.length;
				for (let i: number = 0; i < wave.length; i++) wave[i] -= average;
			}
			
			for (let index: number = 0; index < this._drumWaves.length; index++) {
				const wave: Float32Array = this._drumWaves[index];
				if (index == 0) {
					let drumBuffer: number = 1;
					for (let i: number = 0; i < 32767; i++) {
						wave[i] = (drumBuffer & 1) * 2.0 - 1.0;
						let newBuffer: number = drumBuffer >> 1;
						if (((drumBuffer + newBuffer) & 1) == 1) {
							newBuffer += 1 << 14;
						}
						drumBuffer = newBuffer;
					}
				} else if (index == 1) {
					for (let i: number = 0; i < 32767; i++) {
						wave[i] = Math.random() * 2.0 - 1.0;
					}
				}
				//wave.fixed = true;
			}
			
			if (song != null) {
				this.setSong(song);
			}
		}
		
		public setSong(song: any): void {
			if (typeof(song) == "string") {
				this.song = new Song(song);
			} else if (song instanceof Song) {
				this.song = song;
			}
		}
		
		public play(): void {
			if (!this._paused) return;
			this._paused = false;
			const contextClass = (window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.oAudioContext || window.msAudioContext);
			this._audioCtx = this._audioCtx || new contextClass();
			this._scriptNode = this._audioCtx.createScriptProcessor ? this._audioCtx.createScriptProcessor(2048, 0, 1) : this._audioCtx.createJavaScriptNode(2048, 0, 1); // 2048, 0 input channels, 1 output
			this._scriptNode.onaudioprocess = this._onSampleData.bind(this);
			this._scriptNode.channelCountMode = 'explicit';
			this._scriptNode.channelInterpretation = 'speakers';
			this._scriptNode.connect(this._audioCtx.destination);
			
			this.samplesPerSecond = this._audioCtx.sampleRate;
			this._effectAngle = Math.PI * 2.0 / (this._effectDuration * this.samplesPerSecond);
			this._effectYMult = 2.0 * Math.cos(this._effectAngle);
			this._limitDecay = 1.0 / (2.0 * this.samplesPerSecond);
		}
		
		public pause(): void {
			if (this._paused) return;
			this._paused = true;
			this._scriptNode.disconnect(this._audioCtx.destination);
			if (this._audioCtx.close) {
				this._audioCtx.close(); // firefox is missing this function?
				this._audioCtx = null;
			}
			this._scriptNode = null;
		}
		
		public snapToStart(): void {
			this._bar = 0;
			this.enableIntro = true;
			this.snapToBar();
		}
		
		public snapToBar(): void {
			this._playhead = this._bar;
			this._beat = 0;
			this._part = 0;
			this._arpeggio = 0;
			this._arpeggioSamples = 0;
			this._effectPeriod = 0.0;
			
			this._leadSample = 0.0;
			this._harmonySample = 0.0;
			this._bassSample = 0.0;
			this._drumSample = 0.0;
			this._delayPos = 0;
			this._delayFeedback0 = 0.0;
			this._delayFeedback1 = 0.0;
			this._delayFeedback2 = 0.0;
			this._delayFeedback3 = 0.0;
			for (let i: number = 0; i < this._delayLine.length; i++) this._delayLine[i] = 0.0;
		}
		
		public nextBar(): void {
			const oldBar: number = this._bar;
			this._bar++;
			if (this.enableOutro) {
				if (this._bar >= this.song.bars) {
					this._bar = this.enableIntro ? 0 : this.song.loopStart;
				}
			} else {
				if (this._bar >= this.song.loopStart + this.song.loopLength || this._bar >= this.song.bars) {
					this._bar = this.song.loopStart;
				}
 			}
			this._playhead += this._bar - oldBar;
		}
		
		public prevBar(): void {
			const oldBar: number = this._bar;
			this._bar--;
			if (this._bar < 0) {
				this._bar = this.song.loopStart + this.song.loopLength - 1;
			}
			if (this._bar >= this.song.bars) {
				this._bar = this.song.bars - 1;
			}
			if (this._bar < this.song.loopStart) {
				this.enableIntro = true;
			}
			if (!this.enableOutro && this._bar >= this.song.loopStart + this.song.loopLength) {
				this._bar = this.song.loopStart + this.song.loopLength - 1;
			}
			this._playhead += this._bar - oldBar;
		}
		
		private _onSampleData(audioProcessingEvent: any): void {
			const outputBuffer = audioProcessingEvent.outputBuffer;
			const outputData: Float32Array = outputBuffer.getChannelData(0);
			this.synthesize(outputData, outputBuffer.length);
			/*
			if (this.paused) {
				return;
			} else {
				this.synthesize(event.data, 4096);
			}
			this.stillGoing = true;
			*/
		}
		/*
		private _checkSound(event: TimerEvent): void {
			if (!this.stillGoing) {
				if (soundChannel != null) {
					soundChannel.stop();
				}
				soundChannel = sound.play();
			} else {
				this.stillGoing = false;
			}
		}
		*/
		public synthesize(data: Float32Array, totalSamples: number): void {
			if (this.song == null) {
				for (let i: number = 0; i < totalSamples; i++) {
					data[i] = 0.0;
				}
				return;
			}
			
			let bufferIndex: number = 0;
			
			let stutterFunction: ()=>void;
			if (this.stutterPressed) {
				const barOld: number = this._bar;
				const beatOld: number = this._beat;
				const partOld: number = this._part;
				const arpeggioOld: number = this._arpeggio;
				const arpeggioSamplesOld: number = this._arpeggioSamples;
				const leadPeriodAOld: number = this._leadPeriodA;
				const leadPeriodBOld: number = this._leadPeriodB;
				const leadSampleOld: number = this._leadSample;
				const harmonyPeriodAOld: number = this._harmonyPeriodA;
				const harmonyPeriodBOld: number = this._harmonyPeriodB;
				const harmonySampleOld: number = this._harmonySample;
				const bassPeriodAOld: number = this._bassPeriodA;
				const bassPeriodBOld: number = this._bassPeriodB;
				const bassSampleOld: number = this._bassSample;
				const drumPeriodOld: number = this._drumPeriod;
				const drumSampleOld: number = this._drumSample;
				const drumSignalOld: number = this._drumSignal;
				const effectPeriodOld: number = this._effectPeriod;
				const limitOld: number = this._limit;
				stutterFunction = ()=>{
					this._bar = barOld;
					this._beat = beatOld;
					this._part = partOld;
					this._arpeggio = arpeggioOld;
					this._arpeggioSamples = arpeggioSamplesOld;
					this._leadPeriodA = leadPeriodAOld;
					this._leadPeriodB = leadPeriodBOld;
					this._leadSample = leadSampleOld;
					this._harmonyPeriodA = harmonyPeriodAOld;
					this._harmonyPeriodB = harmonyPeriodBOld;
					this._harmonySample = harmonySampleOld;
					this._bassPeriodA = bassPeriodAOld;
					this._bassPeriodB = bassPeriodBOld;
					this._bassSample = bassSampleOld;
					this._drumPeriod = drumPeriodOld;
					this._drumSample = drumSampleOld;
					this._drumSignal = drumSignalOld;
					this._effectPeriod = effectPeriodOld;
					this._limit = limitOld;
				}
			}
			
			const sampleTime: number = 1.0 / this.samplesPerSecond;
			const samplesPerArpeggio: number = this._getSamplesPerArpeggio();
			const effectYMult = this._effectYMult;
			const limitDecay: number = this._limitDecay;
			const volume: number = this.volume;
			const delayLine: Float32Array = this._delayLine;
			const reverb: number = Math.pow(this.song.reverb / Music.reverbRange, 0.667) * 0.425;
			
			// Check the bounds of the playhead:
			if (this._arpeggioSamples == 0 || this._arpeggioSamples > samplesPerArpeggio) {
				this._arpeggioSamples = samplesPerArpeggio;
			}
			if (this._part >= this.song.parts) {
				this._beat++;
				this._part = 0;
				this._arpeggio = 0;
				this._arpeggioSamples = samplesPerArpeggio;
			}
			if (this._beat >= this.song.beats) {
				this._bar++;
				this._beat = 0;
				this._part = 0;
				this._arpeggio = 0;
				this._arpeggioSamples = samplesPerArpeggio;
				
				if (this.loopCount == -1) {
					if (this._bar < this.song.loopStart && !this.enableIntro) this._bar = this.song.loopStart;
					if (this._bar >= this.song.loopStart + this.song.loopLength && !this.enableOutro) this._bar = this.song.loopStart;
				}
			}
			if (this._bar >= this.song.bars) {
				if (this.enableOutro) {
					this._bar = 0;
					this.enableIntro = true;
					this.pause();
				} else {
					this._bar = this.song.loopStart;
				}
 			}
			if (this._bar >= this.song.loopStart) {
				this.enableIntro = false;
			}
			
			let maxLeadVolume: number;
			let maxHarmVolume: number;
			let maxBassVolume: number;
			let maxDrumVolume: number;
			
			let leadWave: Float64Array;
			let harmWave: Float64Array;
			let bassWave: Float64Array;
			let drumWave: Float32Array;
			
			let leadWaveLength: number;
			let harmWaveLength: number;
			let bassWaveLength: number;
			
			let leadFilterBase: number;
			let harmFilterBase: number;
			let bassFilterBase: number;
			let drumFilter: number;
			
			let leadTremeloScale: number;
			let harmTremeloScale: number;
			let bassTremeloScale: number;
			
			let leadChorusA: number;
			let harmChorusA: number;
			let bassChorusA: number;
			let leadChorusB: number;
			let harmChorusB: number;
			let bassChorusB: number;
			let leadChorusSign: number;
			let harmChorusSign: number;
			let bassChorusSign: number;
			
			let updateInstruments: ()=>void = ()=>{
				const instrumentLead: number = this.song.getPatternInstrument(0, this._bar);
				const instrumentHarm: number = this.song.getPatternInstrument(1, this._bar);
				const instrumentBass: number = this.song.getPatternInstrument(2, this._bar);
				const instrumentDrum: number = this.song.getPatternInstrument(3, this._bar);
				
				maxLeadVolume = Music.channelVolumes[0] * (this.song.instrumentVolumes[0][instrumentLead] == 5 ? 0.0 : Math.pow(2, -Music.volumeValues[this.song.instrumentVolumes[0][instrumentLead]])) * Music.waveVolumes[this.song.instrumentWaves[0][instrumentLead]] * Music.filterVolumes[this.song.instrumentFilters[0][instrumentLead]] * Music.chorusVolumes[this.song.instrumentChorus[0][instrumentLead]] * 0.5;
				maxHarmVolume = Music.channelVolumes[1] * (this.song.instrumentVolumes[1][instrumentHarm] == 5 ? 0.0 : Math.pow(2, -Music.volumeValues[this.song.instrumentVolumes[1][instrumentHarm]])) * Music.waveVolumes[this.song.instrumentWaves[1][instrumentHarm]] * Music.filterVolumes[this.song.instrumentFilters[1][instrumentHarm]] * Music.chorusVolumes[this.song.instrumentChorus[0][instrumentHarm]] * 0.5;
				maxBassVolume = Music.channelVolumes[2] * (this.song.instrumentVolumes[2][instrumentBass] == 5 ? 0.0 : Math.pow(2, -Music.volumeValues[this.song.instrumentVolumes[2][instrumentBass]])) * Music.waveVolumes[this.song.instrumentWaves[2][instrumentBass]] * Music.filterVolumes[this.song.instrumentFilters[2][instrumentBass]] * Music.chorusVolumes[this.song.instrumentChorus[0][instrumentBass]] * 0.5;
				maxDrumVolume = Music.channelVolumes[3] * (this.song.instrumentVolumes[3][instrumentDrum] == 5 ? 0.0 : Math.pow(2, -Music.volumeValues[this.song.instrumentVolumes[3][instrumentDrum]])) * Music.drumVolumes[this.song.instrumentWaves[3][instrumentDrum]];
				
				leadWave = this._waves[this.song.instrumentWaves[0][instrumentLead]];
				harmWave = this._waves[this.song.instrumentWaves[1][instrumentHarm]];
				bassWave = this._waves[this.song.instrumentWaves[2][instrumentBass]];
				drumWave = this._drumWaves[this.song.instrumentWaves[3][instrumentDrum]];
				
				leadWaveLength = leadWave.length;
				harmWaveLength = harmWave.length;
				bassWaveLength = bassWave.length;
				
				leadFilterBase = Math.pow(2, -Music.filterBases[this.song.instrumentFilters[0][instrumentLead]]);
				harmFilterBase = Math.pow(2, -Music.filterBases[this.song.instrumentFilters[1][instrumentHarm]]);
				bassFilterBase = Math.pow(2, -Music.filterBases[this.song.instrumentFilters[2][instrumentBass]]);
				drumFilter = 1.0;
				
				leadTremeloScale = Music.effectTremelos[this.song.instrumentEffects[0][instrumentLead]];
				harmTremeloScale = Music.effectTremelos[this.song.instrumentEffects[1][instrumentHarm]];
				bassTremeloScale = Music.effectTremelos[this.song.instrumentEffects[2][instrumentBass]];
				
				leadChorusA = Math.pow( 2.0, (Music.chorusOffsets[this.song.instrumentChorus[0][instrumentLead]] + Music.chorusValues[this.song.instrumentChorus[0][instrumentLead]]) / 12.0 );
				harmChorusA = Math.pow( 2.0, (Music.chorusOffsets[this.song.instrumentChorus[1][instrumentHarm]] + Music.chorusValues[this.song.instrumentChorus[1][instrumentHarm]]) / 12.0 );
				bassChorusA = Math.pow( 2.0, (Music.chorusOffsets[this.song.instrumentChorus[2][instrumentBass]] + Music.chorusValues[this.song.instrumentChorus[2][instrumentBass]]) / 12.0 );
				leadChorusB = Math.pow( 2.0, (Music.chorusOffsets[this.song.instrumentChorus[0][instrumentLead]] - Music.chorusValues[this.song.instrumentChorus[0][instrumentLead]]) / 12.0 );
				harmChorusB = Math.pow( 2.0, (Music.chorusOffsets[this.song.instrumentChorus[1][instrumentHarm]] - Music.chorusValues[this.song.instrumentChorus[1][instrumentHarm]]) / 12.0 );
				bassChorusB = Math.pow( 2.0, (Music.chorusOffsets[this.song.instrumentChorus[2][instrumentBass]] - Music.chorusValues[this.song.instrumentChorus[2][instrumentBass]]) / 12.0 );
				leadChorusSign = (this.song.instrumentChorus[0][instrumentLead] == 7) ? -1.0 : 1.0;
				harmChorusSign = (this.song.instrumentChorus[1][instrumentHarm] == 7) ? -1.0 : 1.0;
				bassChorusSign = (this.song.instrumentChorus[2][instrumentBass] == 7) ? -1.0 : 1.0;
				if (this.song.instrumentChorus[0][instrumentLead] == 0) this._leadPeriodB = this._leadPeriodA;
				if (this.song.instrumentChorus[1][instrumentHarm] == 0) this._harmonyPeriodB = this._harmonyPeriodA;
				if (this.song.instrumentChorus[2][instrumentBass] == 0) this._bassPeriodB = this._bassPeriodA;
			}
			
			updateInstruments();
			
 			while (totalSamples > 0) {
				if (this._paused) {
					while (totalSamples-- > 0) {
						data[bufferIndex] = 0.0;
						bufferIndex++;
					}
					break;
				}
				
				let samples: number;
				if (this._arpeggioSamples <= totalSamples) {
					samples = this._arpeggioSamples;
				} else {
					samples = totalSamples;
				}
				totalSamples -= samples;
				this._arpeggioSamples -= samples;
				
				///@TODO: If I use "let" for these, Typescript inserts inline functions in place of while loops when transpiling?
				var leadPeriodDelta: number;
				var leadPeriodDeltaScale: number;
				var leadVolume: number;
				var leadVolumeDelta: number;
				var leadFilter: number;
				var leadFilterScale: number;
				var leadVibratoScale: number;
				var harmPeriodDelta: number;
				var harmPeriodDeltaScale: number;
				var harmVolume: number;
				var harmVolumeDelta: number;
				var harmFilter: number;
				var harmFilterScale: number;
				var harmVibratoScale: number;
				var bassPeriodDelta: number;
				var bassPeriodDeltaScale: number;
				var bassVolume: number;
				var bassVolumeDelta: number;
				var bassFilter: number;
				var bassFilterScale: number;
				var bassVibratoScale: number;
				var drumPeriodDelta: number;
				var drumPeriodDeltaScale: number;
				var drumVolume: number;
				var drumVolumeDelta: number;
				var time: number = this._part + this._beat * this.song.parts;
				
				for (let channel: number = 0; channel < 4; channel++) {
					const pattern: BarPattern | null = this.song.getPattern(channel, this._bar);
					
					const attack: number = pattern == null ? 0 : this.song.instrumentAttacks[channel][pattern.instrument];
					
					var tone: Tone = null;
					var prevTone: Tone = null;
					var nextTone: Tone = null;
					if (pattern != null) {
						for (let i: number = 0; i < pattern.tones.length; i++) {
							if (pattern.tones[i].end <= time) {
								prevTone = pattern.tones[i];
							} else if (pattern.tones[i].start <= time && pattern.tones[i].end > time) {
								tone = pattern.tones[i];
							} else if (pattern.tones[i].start > time) {
								nextTone = pattern.tones[i];
								break;
							}
						}
					}
					if (tone != null && prevTone != null && prevTone.end != tone.start) prevTone = null;
					if (tone != null && nextTone != null && nextTone.start != tone.end) nextTone = null;
					
					const channelRoot: number = channel == 3 ? 69 : Music.keyTransposes[this.song.key];
					const intervalScale: number = channel == 3 ? Music.drumInterval : 1;
					let periodDelta: number;
					let periodDeltaScale: number;
					let toneVolume: number;
					let volumeDelta: number;
					let filter: number;
					let filterScale: number;
					let vibratoScale: number;
					let resetPeriod: boolean = false;
					if (this.pianoPressed && channel == this.pianoChannel) {
						const pianoFreq: number = this._frequencyFromPitch(channelRoot + this.pianoNote * intervalScale);
						let pianoPitchDamping: number;
						if (channel == 3) {
							if (this.song.instrumentWaves[3][pattern.instrument] > 0) {
								drumFilter = Math.min(1.0, pianoFreq * sampleTime * 8.0);
								pianoPitchDamping = 24.0;
							} else {
								pianoPitchDamping = 60.0;
							}
						} else {
							pianoPitchDamping = 48.0;
						}
						periodDelta = pianoFreq * sampleTime;
						periodDeltaScale = 1.0;
						toneVolume = Math.pow(2.0, -this.pianoNote * intervalScale / pianoPitchDamping);
						volumeDelta = 0.0;
						filter = 1.0;
						filterScale = 1.0;
						vibratoScale = Math.pow(2.0, Music.effectVibratos[this.song.instrumentEffects[channel][pattern.instrument]] / 12.0 ) - 1.0;
					} else if (tone == null) {
						periodDelta = 0.0;
						periodDeltaScale = 0.0;
						toneVolume = 0.0;
						volumeDelta = 0.0;
						filter = 1.0;
						filterScale = 1.0;
						vibratoScale = 0.0;
						resetPeriod = true;
					} else {
						let pitch: number;
						if (tone.notes.length == 2) {
							pitch = tone.notes[this._arpeggio >> 1];
						} else if (tone.notes.length == 3) {
							pitch = tone.notes[this._arpeggio == 3 ? 1 : this._arpeggio];
						} else if (tone.notes.length == 4) {
							pitch = tone.notes[this._arpeggio];
						} else {
							pitch = tone.notes[0];
						}
						
						let startPin: TonePin = null;
						let endPin: TonePin = null;
						for (const pin of tone.pins) {
							if (pin.time + tone.start <= time) {
								startPin = pin;
							} else {
								endPin = pin;
								break;
							}
						}
						
						const toneStart: number = tone.start * 4;
						const toneEnd:   number = tone.end   * 4;
						const pinStart: number  = (tone.start + startPin.time) * 4;
						const pinEnd:   number  = (tone.start + endPin.time  ) * 4;
						const arpeggioStart: number = time * 4 + this._arpeggio;
						const arpeggioEnd:   number = time * 4 + this._arpeggio + 1;
						const arpeggioRatioStart: number = (arpeggioStart - pinStart) / (pinEnd - pinStart);
						const arpeggioRatioEnd:   number = (arpeggioEnd   - pinStart) / (pinEnd - pinStart);
						let arpeggioVolumeStart: number = startPin.volume * (1.0 - arpeggioRatioStart) + endPin.volume * arpeggioRatioStart;
						let arpeggioVolumeEnd:   number = startPin.volume * (1.0 - arpeggioRatioEnd)   + endPin.volume * arpeggioRatioEnd;
						let arpeggioIntervalStart: number = startPin.interval * (1.0 - arpeggioRatioStart) + endPin.interval * arpeggioRatioStart;
						let arpeggioIntervalEnd:   number = startPin.interval * (1.0 - arpeggioRatioEnd)   + endPin.interval * arpeggioRatioEnd;
						let arpeggioFilterTimeStart: number = startPin.time * (1.0 - arpeggioRatioStart) + endPin.time * arpeggioRatioStart;
						let arpeggioFilterTimeEnd:   number = startPin.time * (1.0 - arpeggioRatioEnd)   + endPin.time * arpeggioRatioEnd;
						
						let inhibitRestart: boolean = false;
						if (arpeggioStart == toneStart) {
							if (attack == 0) {
								inhibitRestart = true;
							} else if (attack == 2) {
								arpeggioVolumeStart = 0.0;
							} else if (attack == 3) {
								if (prevTone == null || prevTone.notes.length > 1 || tone.notes.length > 1) {
									arpeggioVolumeStart = 0.0;
								} else if (prevTone.pins[prevTone.pins.length-1].volume == 0 || tone.pins[0].volume == 0) {
									arpeggioVolumeStart = 0.0;
								//} else if (prevTone.notes[0] + prevTone.pins[prevTone.pins.length-1].interval == pitch) {
								//	arpeggioVolumeStart = 0.0;
								} else {
									arpeggioIntervalStart = (prevTone.notes[0] + prevTone.pins[prevTone.pins.length-1].interval - pitch) * 0.5;
									arpeggioFilterTimeStart = prevTone.pins[prevTone.pins.length-1].time * 0.5;
									inhibitRestart = true;
								}
							}
						}
						if (arpeggioEnd == toneEnd) {
							if (attack == 1 || attack == 2) {
								arpeggioVolumeEnd = 0.0;
							} else if (attack == 3) {
								if (nextTone == null || nextTone.notes.length > 1 || tone.notes.length > 1) {
									arpeggioVolumeEnd = 0.0;
								} else if (tone.pins[tone.pins.length-1].volume == 0 || nextTone.pins[0].volume == 0) {
									arpeggioVolumeStart = 0.0;
								//} else if (nextTone.notes[0] == pitch + tone.pins[tone.pins.length-1].interval) {
									//arpeggioVolumeEnd = 0.0;
								} else {
									arpeggioIntervalEnd = (nextTone.notes[0] + tone.pins[tone.pins.length-1].interval - pitch) * 0.5;
									arpeggioFilterTimeEnd *= 0.5;
								}
							}
						}
						
						const startRatio: number = 1.0 - (this._arpeggioSamples + samples) / samplesPerArpeggio;
						const endRatio:   number = 1.0 - (this._arpeggioSamples)           / samplesPerArpeggio;
						const startInterval: number = arpeggioIntervalStart * (1.0 - startRatio) + arpeggioIntervalEnd * startRatio;
						const endInterval:   number = arpeggioIntervalStart * (1.0 - endRatio)   + arpeggioIntervalEnd * endRatio;
						const startFilterTime: number = arpeggioFilterTimeStart * (1.0 - startRatio) + arpeggioFilterTimeEnd * startRatio;
						const endFilterTime:   number = arpeggioFilterTimeStart * (1.0 - endRatio)   + arpeggioFilterTimeEnd * endRatio;
						const startFreq: number = this._frequencyFromPitch(channelRoot + (pitch + startInterval) * intervalScale);
						const endFreq:   number = this._frequencyFromPitch(channelRoot + (pitch + endInterval) * intervalScale);
						let pitchDamping: number;
						if (channel == 3) {
							if (this.song.instrumentWaves[3][pattern.instrument] > 0) {
								drumFilter = Math.min(1.0, startFreq * sampleTime * 8.0);
								//console.log(drumFilter);
								pitchDamping = 24.0;
							} else {
								pitchDamping = 60.0;
							}
						} else {
							pitchDamping = 48.0;
						}
						let startVol: number = Math.pow(2.0, -(pitch + startInterval) * intervalScale / pitchDamping);
						let endVol:   number = Math.pow(2.0, -(pitch + endInterval) * intervalScale / pitchDamping);
						startVol *= this._volumeConversion(arpeggioVolumeStart * (1.0 - startRatio) + arpeggioVolumeEnd * startRatio);
						endVol   *= this._volumeConversion(arpeggioVolumeStart * (1.0 - endRatio)   + arpeggioVolumeEnd * endRatio);
						const freqScale: number = endFreq / startFreq;
						periodDelta = startFreq * sampleTime;
						periodDeltaScale = Math.pow(freqScale, 1.0 / samples);
						toneVolume = startVol;
						volumeDelta = (endVol - startVol) / samples;
						const timeSinceStart: number = (arpeggioStart + startRatio - toneStart) * samplesPerArpeggio / this.samplesPerSecond;
						if (timeSinceStart == 0.0 && !inhibitRestart) resetPeriod = true;
						
						const filterScaleRate: number = Music.filterDecays[this.song.instrumentFilters[channel][pattern.instrument]];
						filter = Math.pow(2, -filterScaleRate * startFilterTime * 4.0 * samplesPerArpeggio / this.samplesPerSecond);
						const endFilter: number = Math.pow(2, -filterScaleRate * endFilterTime * 4.0 * samplesPerArpeggio / this.samplesPerSecond);
						filterScale = Math.pow(endFilter / filter, 1.0 / samples);
						vibratoScale = (this.song.instrumentEffects[channel][pattern.instrument] == 2 && time - tone.start < 3) ? 0.0 : Math.pow( 2.0, Music.effectVibratos[this.song.instrumentEffects[channel][pattern.instrument]] / 12.0 ) - 1.0;
					}
					
					if (channel == 0) {
						leadPeriodDelta = periodDelta;
						leadPeriodDeltaScale = periodDeltaScale;
						leadVolume = toneVolume * maxLeadVolume;
						leadVolumeDelta = volumeDelta * maxLeadVolume;
						leadFilter = filter * leadFilterBase;
						leadFilterScale = filterScale;
						leadVibratoScale = vibratoScale;
						if (resetPeriod) {
							this._leadSample = 0.0;
							this._leadPeriodA = 0.0;
							this._leadPeriodB = 0.0;
						}
					} else if (channel == 1) {
						harmPeriodDelta = periodDelta;
						harmPeriodDeltaScale = periodDeltaScale;
						harmVolume = toneVolume * maxHarmVolume;
						harmVolumeDelta = volumeDelta * maxHarmVolume;
						harmFilter = filter * harmFilterBase;
						harmFilterScale = filterScale;
						harmVibratoScale = vibratoScale;
						if (resetPeriod) {
							this._harmonySample = 0.0;
							this._harmonyPeriodA = 0.0;
							this._harmonyPeriodB = 0.0;
						}
					} else if (channel == 2) {
						bassPeriodDelta = periodDelta;
						bassPeriodDeltaScale = periodDeltaScale;
						bassVolume = toneVolume * maxBassVolume;
						bassVolumeDelta = volumeDelta * maxBassVolume;
						bassFilter = filter * bassFilterBase;
						bassFilterScale = filterScale;
						bassVibratoScale = vibratoScale;
						if (resetPeriod) {
							this._bassSample = 0.0;
							this._bassPeriodA = 0.0;
							this._bassPeriodB = 0.0;
						}
					} else if (channel == 3) {
						drumPeriodDelta = periodDelta / 32767.0;
						drumPeriodDeltaScale = periodDeltaScale;
						drumVolume = toneVolume * maxDrumVolume;
						drumVolumeDelta = volumeDelta * maxDrumVolume;
					}
				}
				
				let effectY:     number = Math.sin(this._effectPeriod);
				let prevEffectY: number = Math.sin(this._effectPeriod - this._effectAngle);
				
				let leadSample: number = +this._leadSample;
				let leadPeriodA: number = +this._leadPeriodA;
				let leadPeriodB: number = +this._leadPeriodB;
				let harmSample: number = +this._harmonySample;
				let harmPeriodA: number = +this._harmonyPeriodA;
				let harmPeriodB: number = +this._harmonyPeriodB;
				let bassSample: number = +this._bassSample;
				let bassPeriodA: number = +this._bassPeriodA;
				let bassPeriodB: number = +this._bassPeriodB;
				let drumSample: number = +this._drumSample;
				let drumPeriod: number = +this._drumPeriod;
				let delayPos: number = 0|this._delayPos;
				let delayFeedback0: number = +this._delayFeedback0;
				let delayFeedback1: number = +this._delayFeedback1;
				let delayFeedback2: number = +this._delayFeedback2;
				let delayFeedback3: number = +this._delayFeedback3;
				let limit: number = +this._limit;
				
				while (samples) {
					const leadVibrato: number = 1.0 + leadVibratoScale    * effectY;
					const harmVibrato: number = 1.0 + harmVibratoScale * effectY;
					const bassVibrato: number = 1.0 + bassVibratoScale    * effectY;
					const leadTremelo: number = 1.0 + leadTremeloScale    * (effectY - 1.0);
					const harmTremelo: number = 1.0 + harmTremeloScale * (effectY - 1.0);
					const bassTremelo: number = 1.0 + bassTremeloScale    * (effectY - 1.0);
					const temp: number = effectY;
					effectY = effectYMult * effectY - prevEffectY;
					prevEffectY = temp;
					
					leadSample += ((leadWave[0|(leadPeriodA * leadWaveLength)] + leadWave[0|(leadPeriodB * leadWaveLength)] * leadChorusSign) * leadVolume * leadTremelo - leadSample) * leadFilter;
					harmSample += ((harmWave[0|(harmPeriodA * harmWaveLength)] + harmWave[0|(harmPeriodB * harmWaveLength)] * harmChorusSign) * harmVolume * harmTremelo - harmSample) * harmFilter;
					bassSample += ((bassWave[0|(bassPeriodA * bassWaveLength)] + bassWave[0|(bassPeriodB * bassWaveLength)] * bassChorusSign) * bassVolume * bassTremelo - bassSample) * bassFilter;
					drumSample += (drumWave[0|(drumPeriod * 32767.0)] * drumVolume - drumSample) * drumFilter;
					leadVolume += leadVolumeDelta;
					harmVolume += harmVolumeDelta;
					bassVolume += bassVolumeDelta;
					drumVolume += drumVolumeDelta;
					leadPeriodA += leadPeriodDelta * leadVibrato * leadChorusA;
					leadPeriodB += leadPeriodDelta * leadVibrato * leadChorusB;
					harmPeriodA += harmPeriodDelta * harmVibrato * harmChorusA;
					harmPeriodB += harmPeriodDelta * harmVibrato * harmChorusB;
					bassPeriodA += bassPeriodDelta * bassVibrato * bassChorusA;
					bassPeriodB += bassPeriodDelta * bassVibrato * bassChorusB;
					drumPeriod  += drumPeriodDelta;
					leadPeriodDelta *= leadPeriodDeltaScale;
					harmPeriodDelta *= harmPeriodDeltaScale;
					bassPeriodDelta *= bassPeriodDeltaScale;
					drumPeriodDelta *= drumPeriodDeltaScale;
					leadFilter *= leadFilterScale;
					harmFilter *= harmFilterScale;
					bassFilter *= bassFilterScale;
					leadPeriodA -= 0|leadPeriodA;
					leadPeriodB -= 0|leadPeriodB;
					harmPeriodA -= 0|harmPeriodA;
					harmPeriodB -= 0|harmPeriodB;
					bassPeriodA -= 0|bassPeriodA;
					bassPeriodB -= 0|bassPeriodB;
					drumPeriod  -= 0|drumPeriod;
					
					const instrumentSample: number = leadSample + harmSample + bassSample;
					
					// Reverb, implemented using a feedback delay network with a Hadamard matrix and lowpass filters.
					// good ratios:    0.555235 + 0.618033 + 0.818 +   1.0 = 2.991268
					// Delay lengths:  3041     + 3385     + 4481  +  5477 = 16384 = 2^14
					// Buffer offsets: 3041    -> 6426   -> 10907 -> 16384
					const delaySample0: number = delayLine[delayPos] + instrumentSample;
					const delaySample1: number = delayLine[(delayPos +  3041) & 0x3FFF];
					const delaySample2: number = delayLine[(delayPos +  6426) & 0x3FFF];
					const delaySample3: number = delayLine[(delayPos + 10907) & 0x3FFF];
					const delayTemp0: number = -delaySample0 + delaySample1;
					const delayTemp1: number = -delaySample0 - delaySample1;
					const delayTemp2: number = -delaySample2 + delaySample3;
					const delayTemp3: number = -delaySample2 - delaySample3;
					delayFeedback0 += ((delayTemp0 + delayTemp2) * reverb - delayFeedback0) * 0.5;
					delayFeedback1 += ((delayTemp1 + delayTemp3) * reverb - delayFeedback1) * 0.5;
					delayFeedback2 += ((delayTemp0 - delayTemp2) * reverb - delayFeedback2) * 0.5;
					delayFeedback3 += ((delayTemp1 - delayTemp3) * reverb - delayFeedback3) * 0.5;
					delayLine[(delayPos +  3041) & 0x3FFF] = delayFeedback0;
					delayLine[(delayPos +  6426) & 0x3FFF] = delayFeedback1;
					delayLine[(delayPos + 10907) & 0x3FFF] = delayFeedback2;
					delayLine[delayPos] = delayFeedback3;
					delayPos = (delayPos + 1) & 0x3FFF;
					
					let sample: number = delaySample0 + delaySample1 + delaySample2 + delaySample3 + drumSample;
					
					const abs: number = sample < 0.0 ? -sample : sample;
					limit -= limitDecay;
					if (limit < abs) limit = abs;
					sample /= limit * 0.75 + 0.25;
					sample *= volume;
					data[bufferIndex] = sample;
					bufferIndex = bufferIndex + 1;
					samples--;
				}
				
				this._leadSample = leadSample;
				this._leadPeriodA = leadPeriodA;
				this._leadPeriodB = leadPeriodB;
				this._harmonySample = harmSample;
				this._harmonyPeriodA = harmPeriodA;
				this._harmonyPeriodB = harmPeriodB;
				this._bassSample = bassSample;
				this._bassPeriodA = bassPeriodA;
				this._bassPeriodB = bassPeriodB;
				this._drumSample = drumSample;
				this._drumPeriod = drumPeriod;
				this._delayPos = delayPos;
				this._delayFeedback0 = delayFeedback0;
				this._delayFeedback1 = delayFeedback1;
				this._delayFeedback2 = delayFeedback2;
				this._delayFeedback3 = delayFeedback3;
				this._limit = limit;
				
				if ( effectYMult * effectY - prevEffectY > prevEffectY ) {
					this._effectPeriod = Math.asin( effectY );
				} else {
					this._effectPeriod = Math.PI - Math.asin( effectY );
				}
				
				if (this._arpeggioSamples == 0) {
					this._arpeggio++;
					this._arpeggioSamples = samplesPerArpeggio;
					if (this._arpeggio == 4) {
						this._arpeggio = 0;
						this._part++;
						if (this._part == this.song.parts) {
							this._part = 0;
							this._beat++;
							if (this._beat == this.song.beats) {
								this._beat = 0;
								this._effectPeriod = 0.0;
								this._bar++;
								if (this._bar < this.song.loopStart) {
									if (!this.enableIntro) this._bar = this.song.loopStart;
								} else {
									this.enableIntro = false;
								}
								if (this._bar >= this.song.loopStart + this.song.loopLength) {
									if (this.loopCount > 0) this.loopCount--;
									if (this.loopCount > 0 || !this.enableOutro) {
										this._bar = this.song.loopStart;
									}
								}
								if (this._bar >= this.song.bars) {
									this._bar = 0;
									this.enableIntro = true;
									this.pause();
								}
								updateInstruments();
							}
						}
					}
				}
			}
			
			if (this.stutterPressed) stutterFunction();
			this._playhead = (((this._arpeggio + 1.0 - this._arpeggioSamples / samplesPerArpeggio) / 4.0 + this._part) / this.song.parts + this._beat) / this.song.beats + this._bar;
		}
		
		private _frequencyFromPitch(pitch: number): number {
			return 440.0 * Math.pow(2.0, (pitch - 69.0) / 12.0);
		}
		
		private _volumeConversion(toneVolume: number): number {
			return Math.pow(toneVolume / 3.0, 1.5);
		}
		
		private _getSamplesPerArpeggio(): number {
			if (this.song == null) return 0;
			const beatsPerMinute: number = this.song.getBeatsPerMinute();
			const beatsPerSecond: number = beatsPerMinute / 60.0;
			const partsPerSecond: number = beatsPerSecond * this.song.parts;
			const arpeggioPerSecond: number = partsPerSecond * 4.0;
			return Math.floor(this.samplesPerSecond / arpeggioPerSecond);
		}
	}
}
