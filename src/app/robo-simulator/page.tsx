"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, TransformControls, Html, useGLTF, useProgress, Bounds, GizmoHelper, GizmoViewport, Grid, Center, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

type SelectableNode = THREE.Object3D & { name: string };

function Loader() {
    const { progress } = useProgress();
    const pct = Math.max(0, Math.min(100, progress));
    const angle = (pct / 100) * 360;
    const ringBackground = `conic-gradient(#22d3ee ${angle}deg, rgba(255,255,255,0.08) 0)`;
    return (
        <Html center>
            <div style={{ position: "relative" }}>
                <style>{`
                    .rl-card { 
                        backdrop-filter: blur(8px); 
                        background: rgba(8, 12, 26, 0.7); 
                        border: 1px solid rgba(34, 211, 238, 0.25); 
                        box-shadow: 0 10px 30px rgba(0,0,0,0.45), inset 0 0 20px rgba(34,211,238,0.1); 
                        border-radius: 16px; 
                        padding: 18px 20px; 
                        color: #eaf3ff; 
                        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; 
                        width: 260px; 
                    }
                    .rl-top { display: grid; place-items: center; position: relative; }
                    .rl-ring { 
                        width: 138px; height: 138px; border-radius: 999px; padding: 10px; 
                        display: grid; place-items: center; position: relative; 
                        box-shadow: 0 0 30px rgba(34,211,238,0.2), inset 0 0 22px rgba(34,211,238,0.15);
                    }
                    .rl-robot { 
                        width: 118px; height: 118px; border-radius: 16px; position: relative; 
                        background: linear-gradient(160deg, #101a33, #0b1329 60%); 
                        border: 1px solid #1b2a52; 
                        box-shadow: inset 0 -6px 24px rgba(0,0,0,0.6), inset 0 0 20px rgba(34,211,238,0.1);
                    }
                    .rl-antenna { position: absolute; top: -18px; left: 50%; transform: translateX(-50%); width: 4px; height: 18px; background: #22d3ee; border-radius: 2px; box-shadow: 0 0 12px rgba(34,211,238,0.7); animation: bounce 1.4s ease-in-out infinite; }
                    .rl-antenna::after { content: ""; position: absolute; top: -8px; left: 50%; width: 10px; height: 10px; transform: translateX(-50%); background: #22d3ee; border-radius: 999px; box-shadow: 0 0 16px rgba(34,211,238,0.9); }
                    .rl-eyes { position: absolute; top: 40px; left: 50%; transform: translateX(-50%); display: flex; gap: 18px; }
                    .rl-eye { width: 18px; height: 18px; border-radius: 999px; background: radial-gradient(circle at 50% 40%, #bdf3ff, #22d3ee 55%, #0b1329 56%); box-shadow: 0 0 12px rgba(34,211,238,0.9); animation: blink 4s infinite; }
                    .rl-eye.right { animation-delay: 0.12s; }
                    .rl-mouth { position: absolute; bottom: 22px; left: 50%; transform: translateX(-50%); width: 58px; height: 8px; background: linear-gradient(90deg, transparent, #20345f 14%, #22d3ee 50%, #20345f 86%, transparent); border-radius: 6px; filter: drop-shadow(0 0 6px rgba(34,211,238,0.4)); }
                    .rl-gear { position: absolute; opacity: 0.35; }
                    .rl-gear.left { left: -22px; top: 12px; animation: spin 4s linear infinite; }
                    .rl-gear.right { right: -24px; bottom: 8px; animation: spin 3s linear reverse infinite; }
                    .rl-progress { margin-top: 14px; }
                    .rl-bar { height: 8px; border-radius: 999px; background: #0b1020; border: 1px solid #1f2747; overflow: hidden; box-shadow: inset 0 0 10px rgba(34,211,238,0.15); }
                    .rl-fill { height: 100%; background: linear-gradient(90deg, #1cc9f1, #22d3ee, #7dd3fc); width: 0%; box-shadow: 0 0 14px rgba(34,211,238,0.6); animation: shimmer 2.2s linear infinite; }
                    .rl-label { margin-top: 10px; font-size: 12px; opacity: 0.85; text-align: center; letter-spacing: 0.3px; }
                    @keyframes spin { to { transform: rotate(360deg); } }
                    @keyframes shimmer { 0% { filter: saturate(1); } 50% { filter: saturate(1.4); } 100% { filter: saturate(1); } }
                    @keyframes bounce { 0%, 100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, -4px); } }
                    @keyframes blink { 0%, 8%, 100% { transform: scaleY(1); } 4% { transform: scaleY(0.15); } 60% { transform: scaleY(1); } }
                `}</style>

                <div className="rl-card">
                    <div className="rl-top">
                        <div className="rl-ring" style={{ background: ringBackground }}>
                            <svg width="46" height="46" viewBox="0 0 46 46" fill="none" className="rl-gear left">
                                <circle cx="23" cy="23" r="18" stroke="#2a3a66" strokeWidth="4" strokeDasharray="6 8" />
                            </svg>
                            <svg width="42" height="42" viewBox="0 0 42 42" fill="none" className="rl-gear right">
                                <circle cx="21" cy="21" r="16" stroke="#2a3a66" strokeWidth="4" strokeDasharray="5 7" />
                            </svg>
                            <div className="rl-robot">
                                <div className="rl-antenna" />
                                <div className="rl-eyes">
                                    <div className="rl-eye left" />
                                    <div className="rl-eye right" />
                                </div>
                                <div className="rl-mouth" />
                            </div>
                        </div>
                    </div>
                    <div className="rl-progress">
                        <div className="rl-bar">
                            <div className="rl-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="rl-label">Loading {pct.toFixed(0)}%</div>
                    </div>
                </div>
            </div>
        </Html>
    );
}

function useSceneNodes(root: THREE.Object3D | null) {
    return useMemo(() => {
        if (!root) return [] as SelectableNode[];
        const nodes: SelectableNode[] = [];
        root.traverse((obj: THREE.Object3D) => {
            // Exclude helpers and the scene root itself
            if (!(obj as any).isCamera && !(obj as any).isLight) {
                nodes.push(obj as SelectableNode);
            }
        });
        // Prefer likely arm joints first if present
        const score = (n: SelectableNode) => {
            const name = (n.name || "").toLowerCase();
            if (!name) return 0;
            let s = 0;
            if (name.includes("arm")) s += 5;
            if (name.includes("shoulder")) s += 4;
            if (name.includes("elbow")) s += 3;
            if (name.includes("wrist")) s += 2;
            if ((n as any).isBone) s += 1;
            return s;
        };
        return nodes.sort((a, b) => score(b) - score(a));
    }, [root]);
}

function radiansToDegrees(rad: number) {
    return (rad * 180) / Math.PI;
}

function degreesToRadians(deg: number) {
    return (deg * Math.PI) / 180;
}

function RobotModel(props: { onRootReady?: (root: THREE.Object3D) => void }) {
    const { scene } = useGLTF("/R1D3.glb");
    const groupRef = useRef<THREE.Group>(null!);

    useEffect(() => {
        if (groupRef.current && props.onRootReady) props.onRootReady(groupRef.current);
    }, [props]);

    // Fit model scale if needed
    useEffect(() => {
        scene.traverse((obj: THREE.Object3D) => {
            // Ensure meshes cast/receive shadows
            const mesh = obj as THREE.Mesh;
            if (mesh.isMesh) {
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            }
        });
    }, [scene]);

    return (
        <group ref={groupRef}>
            {/* Center the model around origin and normalize size for easier manipulation */}
            <Center>
                <primitive object={scene} />
            </Center>
        </group>
    );
}

// Note: Avoid preloading here so Suspense fallback has time to render visibly during initial load
// useGLTF.preload("/R1D3.glb");

export default function RoboSimulatorPage() {
    // Hydration guard: render only on client after mount to avoid SSR/client mismatches from R3F/Drei
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const orbitRef = useRef<any>(null);
    const transformRef = useRef<any>(null);
    const [sceneRoot, setSceneRoot] = useState<THREE.Object3D | null>(null);
    const nodes = useSceneNodes(sceneRoot);
    const [selectedName, setSelectedName] = useState<string>("");
    const [hoveredName, setHoveredName] = useState<string>("");
    const selected = useMemo(() => nodes.find((n) => n.name === selectedName) || null, [nodes, selectedName]);
    const hovered = useMemo(() => nodes.find((n) => n.name === hoveredName) || null, [nodes, hoveredName]);

    const [rotX, setRotX] = useState<number>(0);
    const [rotY, setRotY] = useState<number>(0);
    const [rotZ, setRotZ] = useState<number>(0);

    // Sync UI when selection changes
    useEffect(() => {
        if (!selected) return;
        const euler = selected.rotation;
        setRotX(radiansToDegrees(euler.x));
        setRotY(radiansToDegrees(euler.y));
        setRotZ(radiansToDegrees(euler.z));
    }, [selected]);

    // Apply slider changes to the selected node
    useEffect(() => {
        if (!selected) return;
        selected.rotation.set(degreesToRadians(rotX), degreesToRadians(rotY), degreesToRadians(rotZ));
    }, [selected, rotX, rotY, rotZ]);

    // When manipulating with TransformControls, update the sliders
    useEffect(() => {
        const controls = transformRef.current as any;
        if (!controls) return;
        const cb = (e: any) => {
            if (!selected) return;
            setRotX(radiansToDegrees(selected.rotation.x));
            setRotY(radiansToDegrees(selected.rotation.y));
            setRotZ(radiansToDegrees(selected.rotation.z));
        };
        controls?.addEventListener?.("objectChange", cb);
        return () => controls?.removeEventListener?.("objectChange", cb);
    }, [selected]);

    // Disable OrbitControls while rotating with TransformControls
    useEffect(() => {
        const controls = transformRef.current as any;
        const orbit = orbitRef.current as any;
        if (!controls || !orbit) return;
        const onDrag = (event: any) => {
            orbit.enabled = !event.value; // value=true when dragging
        };
        controls?.addEventListener?.("dragging-changed", onDrag);
        return () => controls?.removeEventListener?.("dragging-changed", onDrag);
    }, []);

    if (!mounted) {
        return (
            <div style={{ display: "flex", height: "calc(100dvh - 0px)", width: "100%" }} />
        );
    }

    return (
        <div style={{ display: "flex", height: "calc(100dvh - 0px)", width: "100%", overflow: "hidden" }}>
            <div style={{ flex: 1, position: "relative", background: "#0b1020", minWidth: 0, minHeight: 0 }}>
                <Canvas shadows camera={{ position: [3.5, 2.5, 4.5], fov: 50 }}>
                    <color attach="background" args={["#0b1020"]} />

                    <hemisphereLight intensity={0.6} color="#ffffff" groundColor="#223" />
                    <ambientLight intensity={0.2} />
                    <directionalLight
                        castShadow
                        position={[4, 6, 4]}
                        intensity={1.0}
                        shadow-mapSize-width={2048}
                        shadow-mapSize-height={2048}
                    />

                    <Grid args={[20, 20]} cellSize={0.5} sectionColor="#2c3e50" cellColor="#1b2838" infiniteGrid position={[0, -0.001, 0]} />
                    <ContactShadows opacity={0.4} scale={15} blur={2.5} far={15} resolution={1024} position={[0, -0.001, 0]} />

                    <React.Suspense fallback={<Loader />}>
                        <Bounds fit clip observe margin={1.2}>
                            <RobotModel onRootReady={setSceneRoot} />
                        </Bounds>
                    </React.Suspense>

                    {hovered && <BoxHighlight target={hovered} color="#60a5fa" />}
                    {selected && <BoxHighlight target={selected} color="#22d3ee" />}

                    {selected && (
                        <TransformControls ref={transformRef} object={selected} mode="rotate" showX showY showZ />
                    )}

                    <GizmoHelper alignment="bottom-right" margin={[80, 80] as any}>
                        <GizmoViewport labelColor="white" axisHeadScale={1} />
                    </GizmoHelper>

                    <OrbitControls ref={orbitRef} makeDefault enableDamping dampingFactor={0.12} rotateSpeed={0.75} />

                    {/* Loader is provided via Suspense fallback above */}
                </Canvas>
            </div>
            <div style={{ width: 380, borderLeft: "1px solid #1d2333", background: "#0f162e", color: "#eaeefc", padding: 16, height: "100%", display: "flex", flexDirection: "column", overflowY: "auto" }}>
                <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", flex: 1 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, marginBottom: 4 }}>Robot Simulator</h2>
                    <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 12 }}>Select a part, then drag the gizmo or use sliders to rotate.</div>

                    <PartsPanel
                        nodes={nodes}
                        selectedName={selectedName}
                        onSelect={setSelectedName}
                        onHover={setHoveredName}
                    />

                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                        <AngleSlider label="Rotate X (deg)" value={rotX} onChange={setRotX} disabled={!selected} />
                        <AngleSlider label="Rotate Y (deg)" value={rotY} onChange={setRotY} disabled={!selected} />
                        <AngleSlider label="Rotate Z (deg)" value={rotZ} onChange={setRotZ} disabled={!selected} />
                    </div>

                    <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                        <button
                            onClick={() => {
                                if (!selected) return;
                                selected.rotation.set(0, 0, 0);
                                setRotX(0); setRotY(0); setRotZ(0);
                            }}
                            style={buttonStyle}
                        >
                            Reset Part Rotation
                        </button>
                        <button
                            onClick={() => {
                                setSelectedName("");
                            }}
                            style={secondaryButtonStyle}
                        >
                            Deselect
                        </button>
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 16 }}>
                        Tip: If your robot has named joints like "Shoulder_L", "Elbow_R", pick those to limit changes to arms.
                    </div>
                </div>
            </div>
        </div>
    );
}

function BoxHighlight({ target, color }: { target: THREE.Object3D; color: string }) {
    const helperRef = useRef<THREE.BoxHelper | null>(null);
    useEffect(() => {
        if (!target) return;
        const helper = new THREE.BoxHelper(target, new THREE.Color(color));
        helperRef.current = helper;
        return () => {
            // cleanup when target changes/unmounts
            helperRef.current = null;
            try {
                (helper.geometry as any)?.dispose?.();
            } catch { }
        };
    }, [target, color]);
    useFrame(() => helperRef.current?.update());
    if (!helperRef.current) return null;
    return <primitive object={helperRef.current} />;
}

function PartsPanel({
    nodes,
    selectedName,
    onSelect,
    onHover,
}: {
    nodes: SelectableNode[];
    selectedName: string;
    onSelect: (name: string) => void;
    onHover: (name: string) => void;
}) {
    const [query, setQuery] = useState("");
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return nodes;
        return nodes.filter((n) => (n.name || "").toLowerCase().includes(q));
    }, [nodes, query]);

    return (
        <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, opacity: 0.9, marginBottom: 6 }}>Parts</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search parts..."
                    style={{
                        flex: 1,
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid #2a3350",
                        background: "#0b1020",
                        color: "#eaeefc",
                        outline: "none",
                    }}
                />
                <button
                    onClick={() => { setQuery(""); onHover(""); }}
                    style={secondaryButtonStyle}
                >
                    Clear
                </button>
            </div>
            <div style={{
                maxHeight: 220,
                overflow: "auto",
                border: "1px solid #1f2744",
                borderRadius: 10,
                background: "#0b1020",
            }}>
                {filtered.length === 0 && (
                    <div style={{ padding: 12, fontSize: 12, opacity: 0.6 }}>No parts</div>
                )}
                {filtered.map((n) => {
                    const isSelected = n.name === selectedName;
                    const typeLabel = (n as any).isBone ? "Bone" : (n as any).isMesh ? "Mesh" : "Node";
                    return (
                        <div
                            key={n.uuid}
                            onMouseEnter={() => onHover(n.name)}
                            onMouseLeave={() => onHover("")}
                            onClick={() => onSelect(n.name)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 8,
                                padding: "10px 12px",
                                cursor: "pointer",
                                background: isSelected ? "#1b254a" : "transparent",
                                borderBottom: "1px solid #121a33",
                            }}
                        >
                            <div style={{ display: "flex", flexDirection: "column" }}>
                                <span style={{ fontSize: 13, color: "#eaeefc" }}>{n.name || n.uuid}</span>
                                <span style={{ fontSize: 11, opacity: 0.6 }}>{typeLabel}</span>
                            </div>
                            {isSelected && (
                                <span style={{ fontSize: 11, color: "#22d3ee" }}>Selected</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function AngleSlider({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
    return (
        <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.9 }}>{label}</span>
                <code style={{ fontSize: 12, opacity: 0.8 }}>{value.toFixed(0)}°</code>
            </div>
            <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                disabled={!!disabled}
                style={{ width: "100%" }}
            />
        </div>
    );
}

const buttonStyle: React.CSSProperties = {
    padding: "8px 12px",
    borderRadius: 8,
    background: "#2f5cff",
    color: "white",
    border: "1px solid #2f5cff",
    cursor: "pointer",
    fontSize: 13,
};

const secondaryButtonStyle: React.CSSProperties = {
    padding: "8px 12px",
    borderRadius: 8,
    background: "transparent",
    color: "#eaeefc",
    border: "1px solid #2a3350",
    cursor: "pointer",
    fontSize: 13,
};


