import { AudioClip, AudioSource, Node, Tween, tween } from "cc";
import { oops } from "db://oops-framework/core/Oops";

const soundBundle = "bundle";
const masterGain = 0.5;
const tracks = [
    "Kubbi - Ember - 01 Pathfinder",
    "Kubbi - Ember - 02 Ember",
    "Kubbi - Ember - 03 Firelight",
    "Kubbi - Ember - 04 Cascade",
    "Kubbi - Ember - 05 Compass",
];
const importedNames = new Map<string, string>([
    ["399656__bajko__sfx-thunder-blast", "sfxBossDeath"],
    ["Body Head (Headshot) 1", "sfxCrit"],
    ["Bonus 2", "sfxVictory"],
    ["Buff 4", "sfxShopSynergy"],
    ["Cannon shots 1", "sfxCannon"],
    ["Click", "sfxCountdown"],
    ["Coins 7", "sfxGold"],
    ["Coins 8", "sfxShopBuy"],
    ["Coins 9", "sfxShopSell"],
    ["Concrete 6", "sfxWallHit"],
    ["Error 2", "sfxShopError"],
    ["Explosion Flesh_01", "sfxEnemyDeath"],
    ["Explosion Grenade_04", "sfxArea"],
    ["Player Takes Damage 2", "sfxPlayerHurt"],
    ["Pop sounds 10", "sfxHit"],
    ["Releasing Bow String 1", "sfxArrow"],
    ["Shield Impacts Sword 1", "sfxShield"],
    ["Shooting Projectile (Classic) 11", "sfxShoot"],
    ["Spark 1", "sfxChain"],
    ["Switch", "sfxShopRefresh"],
    ["Switch 3", "sfxShopStartBattle"],
    ["Throwing Knife (Thrown) 3", "sfxKnife"],
    ["Weapon Swap 2", "sfxShopSwap"],
]);

export const switchSound = "Switch";
export const switchAltSound = "Switch 3";
export const coinSounds = ["Coins 7", "Coins 8", "Coins 9"];

export class GameAudio {
    private static readonly clips = new Map<string, Promise<AudioClip | null>>();
    private static readonly effects = new Map<AudioSource, ReturnType<typeof setTimeout>>();
    private static readonly musicMix = { gain: 0.5, rate: 1 };
    private static music?: AudioSource;
    private static musicTargetGain = 0.5;
    private static musicTargetRate = 1;
    private static musicRequest = 0;
    private static playingTrack = "";
    private static effectGeneration = 0;

    /** 预加载菜单或战斗入口指定的常用采样 names，降低首次播放延迟。 */
    static preloadEffects(names: readonly string[]) {
        names.forEach((name) => {
            this.loadClip(name);
        });
    }

    /** 为单个采样或候选池 clip 播放独立声部，可配置音量 gain 和变调范围。 */
    static playEffect(clip: string | readonly string[], gain: number = 0.5, minRate: number = 0.95, maxRate: number = 1.05) {
        if (!oops.audio.effect.getSwitch()) {
            return;
        }
        const name = typeof clip === "string" ? clip : clip[Math.floor(Math.random() * clip.length)];
        const rate = minRate + Math.random() * (maxRate - minRate);
        const generation = this.effectGeneration;
        this.loadClip(name).then((asset) => {
            if (!asset || generation !== this.effectGeneration || !oops.audio.effect.getSwitch()) {
                return;
            }
            if (this.effects.size >= Math.max(1, AudioSource.maxAudioChannel - 1)) {
                const oldest = this.effects.keys().next().value;
                if (oldest) {
                    this.releaseEffect(oldest);
                }
            }
            const node = new Node(name);
            const source = node.addComponent(AudioSource);
            source.playOnAwake = false;
            source.clip = asset;
            source.volume = masterGain * gain * oops.audio.effect.getVolume();
            node.parent = oops.audio.node;
            const timer = setTimeout(() => {
                this.releaseEffect(source);
            }, (asset.getDuration() / Math.min(rate, 1) + 2) * 1000);
            this.effects.set(source, timer);
            node.once(AudioSource.EventType.STARTED, () => {
                this.applyRate(source, rate);
            });
            node.once(AudioSource.EventType.ENDED, () => {
                this.releaseEffect(source);
            });
            source.play();
        });
    }

    /** 停止在播音效并取消尚在加载中的播放请求。 */
    static stopEffects() {
        this.effectGeneration += 1;
        this.effects.forEach((timer, source) => {
            this.releaseEffect(source, timer);
        });
    }

    /** 播放转场三层音效，enterBattle 区分出战与菜单方向。 */
    static playTransition(enterBattle: boolean) {
        this.playEffect(enterBattle ? "Wind Bolt 8" : "Wind Bolt 12");
        this.playSwitchPair();
    }

    /** 播放原版 UI 的双层开关反馈。 */
    static playSwitchPair() {
        this.playEffect(switchAltSound);
        this.playEffect(switchSound);
    }

    /** 在重新开局时结束当前曲目并重新随机选曲。 */
    static restartMusic() {
        if (this.music) {
            this.music.stop();
            this.playNextTrack();
        }
    }

    /** 保持当前曲目进度，用 duration 秒过渡到目标音量 gain 与播放速度 rate。 */
    static setMusic(gain: number, rate: number = 1, duration: number = 0) {
        if (!this.music) {
            const node = new Node("GameMusic");
            const source = node.addComponent(AudioSource);
            source.playOnAwake = false;
            node.parent = oops.audio.node;
            node.on(AudioSource.EventType.ENDED, () => {
                this.playNextTrack();
            });
            node.on(AudioSource.EventType.STARTED, () => {
                this.applyMusicMix();
            });
            this.music = source;
            this.musicMix.gain = gain;
            this.musicMix.rate = rate;
            this.playNextTrack();
        }
        if (gain === this.musicTargetGain && rate === this.musicTargetRate && duration > 0) {
            return;
        }
        this.musicTargetGain = gain;
        this.musicTargetRate = rate;
        Tween.stopAllByTarget(this.musicMix);
        if (duration > 0) {
            tween(this.musicMix).to(duration, { gain, rate }, {
                onUpdate: () => {
                    this.applyMusicMix();
                },
            }).start();
        } else {
            this.musicMix.gain = gain;
            this.musicMix.rate = rate;
            this.applyMusicMix();
        }
    }

    /** 将当前场景混音及用户静音设置同步给背景音乐。 */
    static applyMusicMix() {
        const source = this.music;
        if (!source) {
            return;
        }
        const appliedRate = this.applyRate(source, this.musicMix.rate);
        const gain = this.musicMix.gain * this.musicMix.rate / appliedRate;
        source.volume = oops.audio.music.getSwitch() ? masterGain * gain * oops.audio.music.getVolume() : 0;
    }

    private static playNextTrack() {
        const name = tracks[Math.floor(Math.random() * tracks.length)];
        const request = ++this.musicRequest;
        this.loadClip(name).then((asset) => {
            const source = this.music;
            if (!source || this.musicRequest !== request || !asset) {
                return;
            }
            const previousClip = source.clip;
            const previousTrack = this.playingTrack;
            this.playingTrack = name;
            source.clip = asset;
            source.currentTime = 0;
            this.applyMusicMix();
            source.play();
            if (previousClip && previousTrack !== name) {
                this.clips.delete(previousTrack);
                previousClip.decRef();
            }
        });
    }

    private static loadClip(name: string) {
        const cached = this.clips.get(name);
        if (cached) {
            return cached;
        }
        const path = importedNames.get(name) ?? name;
        const pending = oops.res.load(soundBundle, `audios/${path}`, AudioClip).then((asset) => {
            if (!asset) {
                this.clips.delete(name);
            }
            return asset ?? null;
        }, (error: unknown) => {
            this.clips.delete(name);
            console.error(`加载音频失败：${name}`, error);
            return null;
        });
        this.clips.set(name, pending);
        return pending;
    }

    private static releaseEffect(source: AudioSource, timer = this.effects.get(source)) {
        if (this.effects.delete(source)) {
            clearTimeout(timer);
            source.stop();
            source.node.destroy();
        }
    }

    // Creator 3.8 的 AudioSource 未公开变调接口，按实际播放器能力设置播放速度。
    private static applyRate(source: AudioSource, rate: number) {
        const wrapper = Reflect.get(source, "_player");
        const player = wrapper && Reflect.get(wrapper, "_player");
        const buffer = player && Reflect.get(player, "_sourceNode");
        const element = player && Reflect.get(player, "_domAudio");
        const innerAudio = player && Reflect.get(player, "_innerAudioContext");
        if (buffer) {
            buffer.playbackRate.value = rate;
            return rate;
        }
        if (element) {
            element.preservesPitch = false;
            element.playbackRate = Math.max(0.0625, rate);
            return element.playbackRate;
        }
        if (innerAudio && Reflect.has(innerAudio, "playbackRate")) {
            innerAudio.playbackRate = Math.max(0.5, Math.min(2, rate));
            return innerAudio.playbackRate || 1;
        }
        return 1;
    }
}
