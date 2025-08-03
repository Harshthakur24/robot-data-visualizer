'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Play, Pause, RotateCcw, Upload, Eye, EyeOff, Activity, Video, Bot, Settings, FileText, ChevronDown } from 'lucide-react';

//- INTERFACES & TYPES ---------------------------------- //

interface TimeStampedTensor<T> {
  timestamp: string;
  tensor: T;
  dtype: string;
}

interface VideoTensor {
  camera_name: string;
  tensor: number[] | string;
  dtype: 'uint8';
}

interface Modalities {
  video_tensors: VideoTensor[];
  joint_states: TimeStampedTensor<number[]>[];
  cmd_vel: TimeStampedTensor<number[]>;
  gripper_status: TimeStampedTensor<number[]>[];
}

interface Episode {
  episode_id: string;
  start_timestamp: string;
  duration_secs: number;
  frames_per_episode: number;
  modalities: Modalities;
}

interface RobotData {
  robot_task: string;
  episodes: Episode[];
}

type Panel = 'joints' | 'gripper' | 'velocity' | 'video';

//- MOCK DATA GENERATOR ------------------------------------ //

const generateMockData = (): RobotData => {
  const createEpisode = (id: number): Episode => {
    const frames = 150;
    return {
      episode_id: `Episode ${String(id).padStart(2, '0')}`,
      start_timestamp: new Date(Date.now() + id * 5 * 60 * 1000).toISOString(),
      duration_secs: 5.0,
      frames_per_episode: frames,
      modalities: {
        video_tensors: [
          { camera_name: "Front Camera", tensor: "...", dtype: "uint8" },
          { camera_name: "Wrist Camera", tensor: "...", dtype: "uint8" },
        ],
        joint_states: Array.from({ length: frames }, (_, i) => ({
          timestamp: new Date(Date.now() + i * 33).toISOString(),
          tensor: [
            Math.sin(i * 0.1 * id) * 30, Math.cos(i * 0.15) * 45, Math.sin(i * 0.08) * 60,
            Math.cos(i * 0.12) * 90, Math.sin(i * 0.2) * 180, Math.cos(i * 0.18) * 270
          ],
          dtype: "float32"
        })),
        cmd_vel: {
          timestamp: new Date().toISOString(),
          tensor: [0.5, 0.2, 0.1, 0.0, 0.0, 0.3],
          dtype: "float32"
        },
        gripper_status: Array.from({ length: frames }, (_, i) => ({
          timestamp: new Date(Date.now() + i * 33).toISOString(),
          tensor: [
            Math.max(0, Math.min(1, 0.5 + Math.sin(i * 0.2) * 0.5)),
            Math.random() > 0.9 ? 1 : 0,
            Math.random() * 5
          ],
          dtype: "float32"
        }))
      }
    };
  };

  return {
    robot_task: "Precision Assembly Task",
    episodes: [createEpisode(1), createEpisode(2), createEpisode(3)]
  };
};

//- CUSTOM CHART TOOLTIP ---------------------------------------------------- //
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: number }) => {
  if (active && payload && payload.length && typeof label === 'number') {
    return (
      <div className="bg-white/95 backdrop-blur-xl shadow-2xl border border-gray-200/50 rounded-xl p-4 font-mono text-sm">
        <p className="font-semibold text-gray-800 mb-2">{`${label.toFixed(2)}s`}</p>
        {payload.map((pld, index: number) => (
          <div key={index} style={{ color: pld.color }} className="flex justify-between items-center gap-4">
            <span className="capitalize">{pld.name}:</span>
            <span className="font-semibold">{Number(pld.value).toFixed(2)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

//- MAIN COMPONENT ---------------------------------------------------------------------- //
const Home = () => {
  const [robotData, setRobotData] = useState<RobotData | null>(null);
  const [activeEpisodeIndex, setActiveEpisodeIndex] = useState<number>(0);
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isSpeedDropdownOpen, setIsSpeedDropdownOpen] = useState<boolean>(false);
  const speedDropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [visiblePanels, setVisiblePanels] = useState<Record<Panel, boolean>>({
    video: true,
    joints: true,
    gripper: true,
    velocity: true
  });

  const currentEpisode = useMemo(() => robotData?.episodes[activeEpisodeIndex], [robotData, activeEpisodeIndex]);

  // Load mock data on mount
  useEffect(() => {
    setRobotData(generateMockData());
  }, []);

  // Playback loop
  useEffect(() => {
    if (!isPlaying || !currentEpisode) return;
    const interval = setInterval(() => {
      setCurrentFrame(prev => {
        if (prev >= currentEpisode.frames_per_episode - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, (1000 / 30) / playbackSpeed);
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, currentEpisode]);

  // Reset frame when episode changes
  useEffect(() => {
    setCurrentFrame(0);
    setIsPlaying(false);
  }, [activeEpisodeIndex])

  // Close speed dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      // Don't close if clicking on the dropdown portal
      if (!target.closest('.speed-dropdown') && !target.closest('.speed-dropdown-portal')) {
        setIsSpeedDropdownOpen(false);
      }
    };

    if (isSpeedDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSpeedDropdownOpen]);

  // Chart data memoization
  const chartData = useMemo(() => {
    if (!currentEpisode) return [];
    return Array.from({ length: currentEpisode.frames_per_episode }, (_, i) => {
      const jointState = currentEpisode.modalities.joint_states[i]?.tensor;
      const gripperState = currentEpisode.modalities.gripper_status[i]?.tensor;
      return {
        frame: i,
        time: i * (currentEpisode.duration_secs / currentEpisode.frames_per_episode),
        joint1: jointState?.[0] ?? 0,
        joint2: jointState?.[1] ?? 0,
        joint3: jointState?.[2] ?? 0,
        gripper_pos: (gripperState?.[0] ?? 0) * 100,
        gripper_force: gripperState?.[2] ?? 0,
      };
    });
  }, [currentEpisode]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        try {
          if (typeof e.target?.result === 'string') {
            const data = JSON.parse(e.target.result) as RobotData;
            setRobotData(data);
            setActiveEpisodeIndex(0);
            setCurrentFrame(0);
          }
        } catch (error) {
          console.error('Invalid JSON file:', error);
          alert('Error: The uploaded file is not valid JSON.');
        }
      };
      reader.readAsText(file);
    }
  };

  const togglePanel = (panel: Panel) => setVisiblePanels(p => ({ ...p, [panel]: !p[panel] }));

  if (!robotData || !currentEpisode) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
              <Activity className="w-8 h-8 text-white animate-pulse" />
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Loading Dashboard</h3>
          <p className="text-gray-500">Initializing robot data visualization...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 font-inter text-gray-800">
      {/* Sidebar */}
      <aside className="w-80 h-full bg-white/80 backdrop-blur-xl border-r border-gray-200/50 shadow-xl flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">RoboViz</h1>
              <p className="text-xs text-gray-500 font-medium">Data Visualization Platform</p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span className="text-md font-semibold text-blue-900">Current Task</span>
            </div>
            <p className="text-blue-800 ml-7 font-medium text-sm leading-relaxed">{robotData.robot_task}</p>
          </div>
        </div>

        {/* Episodes */}
        <div className="flex-1 p-6 overflow-y-auto">
          <h3 className="text-xl ml-2 font-bold font-mono text-gray-900 mb-4 tracking-wide uppercase">Episodes</h3>
          <div className="space-y-3 font-mono scale-95">
            {robotData.episodes.map((ep, index) => (
              <button
                key={ep.episode_id}
                onClick={() => setActiveEpisodeIndex(index)}
                className={`w-full text-left p-4 rounded-xl hover:cursor-pointer hover:scale-105 hover:shadow-lg transition-all duration-200 group ${activeEpisodeIndex === index
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 scale-[1.02]'
                  : 'bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 hover:shadow-md'
                  }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold">{ep.episode_id}</p>
                  <div className={`w-2 h-2 rounded-full ${activeEpisodeIndex === index ? 'bg-white' : 'bg-green-400'}`} />
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className={activeEpisodeIndex === index ? 'text-blue-100' : 'text-gray-500'}>
                    {ep.duration_secs.toFixed(1)}s
                  </span>
                  <span className={activeEpisodeIndex === index ? 'text-blue-100' : 'text-gray-500'}>
                    {ep.frames_per_episode} frames
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Upload */}
        {/* <div className="p-6 border-t border-gray-100">
          <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" id="file-upload" />
          <label
            htmlFor="file-upload"
            className="w-full justify-center px-4 py-3 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white rounded-xl cursor-pointer flex items-center gap-2 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02]"
          >
            <Upload className="w-4 h-4" /> Import Data
          </label>
        </div> */}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header & Controls */}
        <header className="bg-white/90 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">{currentEpisode.episode_id}</h2>
                <p className="text-gray-500 font-medium">Real-time data visualization and analysis</p>
              </div>


            </div>

            {/* Controls */}
            <div className="grid grid-cols-3 items-center gap-8">
              <div className="flex items-center gap-3 scale-95">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="px-3 py-3 bg-gradient-to-r hover:cursor-pointer from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 rounded-xl flex items-center gap-2 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl hover:scale-105 min-w-[120px] justify-center"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  {isPlaying ? 'Pause' : 'Play'}
                </button>

                <button
                  onClick={() => setCurrentFrame(0)}
                  className="p-3 bg-white border border-gray-200 hover:bg-gray-50 hover:cursor-pointer hover:border-gray-300 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
                  title="Reset to start"
                >
                  <RotateCcw className="w-5 h-5 text-gray-600" />
                </button>

                <div className="relative speed-dropdown" ref={speedDropdownRef}>
                  <button
                    onClick={() => {
                      if (!isSpeedDropdownOpen && speedDropdownRef.current) {
                        const rect = speedDropdownRef.current.getBoundingClientRect();
                        setDropdownPosition({
                          top: rect.bottom + 4,
                          left: rect.left,
                          width: rect.width
                        });
                      }
                      setIsSpeedDropdownOpen(!isSpeedDropdownOpen);
                    }}
                    className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-xl px-4 py-3 hover:cursor-pointer text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm hover:shadow-md transition-all duration-200 min-w-[140px] text-gray-700 flex items-center justify-between"
                  >
                    <span>{playbackSpeed}× Speed</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isSpeedDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Timeline */}
              <div className="col-span-2 h-16 ml-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-2 border border-gray-100">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                    onMouseMove={(e) => {
                      if (e.isTooltipActive && typeof e.activeTooltipIndex === 'number' && !isPlaying) {
                        setCurrentFrame(e.activeTooltipIndex);
                      }
                    }}
                  >
                    <defs>
                      <linearGradient id="timelineGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="joint1" stroke="#3b82f6" strokeWidth={2} fill="url(#timelineGradient)" />
                    <XAxis dataKey="time" hide />
                    <YAxis domain={['dataMin - 5', 'dataMax + 5']} hide />
                    <ReferenceLine x={chartData[currentFrame]?.time} stroke="#ef4444" strokeWidth={3} strokeDasharray="none" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex items-center justify-center gap-6 mt-3 text-sm font-mono bg-gray-50 rounded-lg py-2 px-4">
              <span className="text-gray-600">Frame <span className="font-bold text-gray-900">{currentFrame + 1}</span> of <span className="font-bold text-gray-900">{currentEpisode.frames_per_episode}</span></span>
              <div className="w-1 h-1 bg-gray-400 rounded-full" />
              <span className="text-gray-600">Time <span className="font-bold text-gray-900">{(currentFrame * (currentEpisode.duration_secs / currentEpisode.frames_per_episode)).toFixed(2)}s</span> of <span className="font-bold text-gray-900">{currentEpisode.duration_secs.toFixed(2)}s</span></span>
            </div>
          </div>
        </header>

        {/* Panels */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-6">
            {visiblePanels.video && (
              <div className="bg-white/90 backdrop-blur-xl border border-gray-200/50 rounded-2xl shadow-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                    <Video className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Camera Feeds</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {currentEpisode.modalities.video_tensors.map(cam => (
                    <div key={cam.camera_name} className="group">
                      <h4 className="font-semibold text-sm text-gray-600 mb-3">{cam.camera_name}</h4>
                      <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center border border-gray-200 group-hover:shadow-lg transition-all duration-200">
                        <div className="text-center">
                          <Video className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                          <p className="text-xs text-gray-500 font-medium">Video Stream</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {visiblePanels.joints && (
              <div className="bg-white/90 backdrop-blur-xl border border-gray-200/50 rounded-2xl shadow-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                    <Settings className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Joint States</h3>
                </div>
                <div className="focus:outline-none">
                  <ResponsiveContainer width="100%" height={280} className="focus:outline-none">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="time"
                        tickFormatter={(v: number) => `${v.toFixed(1)}s`}
                        style={{ fontSize: 12 }}
                        stroke="#6b7280"
                      />
                      <YAxis style={{ fontSize: 12 }} stroke="#6b7280" />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <ReferenceLine x={chartData[currentFrame]?.time} stroke="#ef4444" strokeWidth={2} />
                      <Line type="monotone" dataKey="joint1" stroke="#3b82f6" dot={false} strokeWidth={3} name="Joint 1" />
                      <Line type="monotone" dataKey="joint2" stroke="#8b5cf6" dot={false} strokeWidth={3} name="Joint 2" />
                      <Line type="monotone" dataKey="joint3" stroke="#ec4899" dot={false} strokeWidth={3} name="Joint 3" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {visiblePanels.gripper && (
              <div className="bg-white/90 backdrop-blur-xl border border-gray-200/50 rounded-2xl shadow-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                    <Activity className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Gripper Analysis</h3>
                </div>
                <div className="focus:outline-none">
                  <ResponsiveContainer width="100%" height={280} className="focus:outline-none">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="posGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="forceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#059669" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="time"
                        tickFormatter={(v: number) => `${v.toFixed(1)}s`}
                        style={{ fontSize: 12 }}
                        stroke="#6b7280"
                      />
                      <YAxis yAxisId="left" orientation="left" stroke="#6366f1" style={{ fontSize: 12 }} />
                      <YAxis yAxisId="right" orientation="right" stroke="#059669" style={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <ReferenceLine x={chartData[currentFrame]?.time} stroke="#ef4444" strokeWidth={2} />
                      <Area yAxisId="left" type="monotone" dataKey="gripper_pos" name="Position (%)" stroke="#6366f1" fill="url(#posGradient)" strokeWidth={2.5} />
                      <Area yAxisId="right" type="monotone" dataKey="gripper_force" name="Force (N)" stroke="#059669" fill="url(#forceGradient)" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {visiblePanels.velocity && (
              <div className="bg-white/90 backdrop-blur-xl border border-gray-200/50 rounded-2xl shadow-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-gradient-to-r from-slate-600 to-gray-700 rounded-lg flex items-center justify-center">
                    <Activity className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Command Velocity</h3>
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800 text-sm uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">Linear Velocity</h4>
                    <div className="space-y-3 font-mono text-sm">
                      {['VX', 'VY', 'VZ'].map((label, idx) => (
                        <div key={label} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                          <span className="font-semibold text-gray-700">{label}:</span>
                          <span className="font-bold text-gray-900">{currentEpisode.modalities.cmd_vel.tensor[idx].toFixed(3)} m/s</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800 text-sm uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">Angular Velocity</h4>
                    <div className="space-y-3 font-mono text-sm">
                      {['WX', 'WY', 'WZ'].map((label, idx) => (
                        <div key={label} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                          <span className="font-semibold text-gray-700">{label}:</span>
                          <span className="font-bold text-gray-900">{currentEpisode.modalities.cmd_vel.tensor[idx + 3].toFixed(3)} rad/s</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Speed Dropdown Portal */}
      {isSpeedDropdownOpen && (
        <div
          className="fixed bg-white border border-gray-200 rounded-xl shadow-lg z-[9999] overflow-hidden speed-dropdown-portal"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width
          }}
        >
          {[0.5, 1, 2, 4].map((speed) => (
            <button
              key={speed}
              onClick={(e) => {
                e.stopPropagation();
                console.log('Speed selected:', speed);
                setPlaybackSpeed(speed);
                setIsSpeedDropdownOpen(false);
              }}
              className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors duration-150 hover:bg-gray-50 hover:cursor-pointer ${playbackSpeed === speed
                ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
                : 'text-gray-700'
                }`}
            >
              {speed}× Speed
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;