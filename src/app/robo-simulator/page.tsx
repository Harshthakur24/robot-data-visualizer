"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, TransformControls, Html, useGLTF, useProgress, Bounds, GizmoHelper, GizmoViewport, Grid, Center, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

// Local lightweight types (avoid external control typings during build)
type TransformControlsLike = {
    addEventListener: (type: string, listener: (e: unknown) => void) => void;
    removeEventListener: (type: string, listener: (e: unknown) => void) => void;
} | null;
type OrbitControlsLike = { enabled: boolean } | null;

type SelectableNode = THREE.Object3D & { name: string };

function Loader() {
    const { progress } = useProgress();
    const pct = Math.max(0, Math.min(100, progress));
    return (
        <Html center>
            <div style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                padding: "16px 18px",
                borderRadius: 12,
                backdropFilter: "blur(8px)",
                background: "rgba(8,12,26,0.55)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#eaeefc",
                fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
                boxShadow: "0 10px 28px rgba(0,0,0,0.35)"
            }}>
                <div style={{ fontSize: 12, opacity: 0.95, letterSpacing: 0.2 }}>Loading… {pct.toFixed(0)}%</div>
                <div style={{ width: 260 }}>
                    <div className="lb-bar">
                        <div className="lb-fill" style={{ width: `${pct}%` }} />
                    </div>
                </div>
                <div className="lb-dots">
                    <span className="lb-dot" />
                    <span className="lb-dot" />
                    <span className="lb-dot" />
                </div>
            </div>
            <style>{`
                .lb-bar { position: relative; height: 10px; border-radius: 999px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); overflow: hidden; box-shadow: inset 0 0 10px rgba(34,211,238,0.12); }
                .lb-fill { height: 100%; border-radius: 999px; position: relative; background: linear-gradient(90deg, #7dd3fc, #22d3ee, #60a5fa); box-shadow: 0 0 14px rgba(34,211,238,0.55); }
                .lb-fill::after { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(45deg, rgba(255,255,255,0.22) 0 10px, rgba(255,255,255,0.0) 10px 20px); opacity: 0.35; mix-blend-mode: screen; animation: lb-slide 1.1s linear infinite; }
                .lb-dots { display: flex; gap: 6px; align-items: center; justify-content: center; }
                .lb-dot { width: 6px; height: 6px; border-radius: 50%; background: #a5f3fc; opacity: 0.7; animation: lb-pulse 1.4s ease-in-out infinite; box-shadow: 0 0 10px rgba(165,243,252,0.65); }
                .lb-dot:nth-child(2) { animation-delay: 0.15s; }
                .lb-dot:nth-child(3) { animation-delay: 0.3s; }
                @keyframes lb-slide { from { background-position: 0 0; } to { background-position: 24px 0; } }
                @keyframes lb-pulse { 0%, 100% { transform: scale(0.75); opacity: 0.5; } 50% { transform: scale(1); opacity: 1; } }
            `}</style>
        </Html>
    );
}

function useSceneNodes(root: THREE.Object3D | null) {
    return useMemo(() => {
        if (!root) return [] as SelectableNode[];
        const nodes: SelectableNode[] = [];
        root.traverse((obj: THREE.Object3D) => {
            if ((obj as THREE.Object3D) instanceof THREE.Camera) return;
            if ((obj as THREE.Object3D) instanceof THREE.Light) return;
            nodes.push(obj as SelectableNode);
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
            if ((n as unknown as THREE.Bone) instanceof THREE.Bone) s += 1;
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
    const orbitRef = useRef<OrbitControlsLike>(null);
    const transformRef = useRef<TransformControlsLike>(null);
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
        const controls = transformRef.current;
        if (!controls) return;
        const cb = () => {
            if (!selected) return;
            setRotX(radiansToDegrees(selected.rotation.x));
            setRotY(radiansToDegrees(selected.rotation.y));
            setRotZ(radiansToDegrees(selected.rotation.z));
        };
        controls.addEventListener("objectChange", cb);
        return () => controls.removeEventListener("objectChange", cb);
    }, [selected]);

    // Disable OrbitControls while rotating with TransformControls
    useEffect(() => {
        const controls = transformRef.current;
        const orbit = orbitRef.current;
        if (!controls || !orbit) return;
        const onDrag = (event: unknown) => {
            const value = Boolean((event as { value?: boolean })?.value);
            orbit.enabled = !value; // value=true when dragging
        };
        controls.addEventListener("dragging-changed", onDrag);
        return () => controls.removeEventListener("dragging-changed", onDrag);
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

                    <hemisphereLight intensity={0.5} color="#ffffff" groundColor="#4a5568" />
                    <ambientLight intensity={0.25} />
                    {/* Key + fill lights to highlight the robot */}
                    <spotLight position={[3, 5.5, 2.5]} angle={0.45} penumbra={0.6} intensity={1.2} castShadow color="#ffffff" />
                    <pointLight position={[-1.5, 2.2, 1.5]} intensity={0.35} color="#cbd5e1" distance={12} />
                    <directionalLight
                        castShadow
                        position={[4, 6, 4]}
                        intensity={1.0}
                        shadow-mapSize-width={2048}
                        shadow-mapSize-height={2048}
                    />

                    <Grid args={[20, 20]} cellSize={0.5} sectionColor="#3a4252" cellColor="#253044" infiniteGrid position={[0, -0.001, 0]} />
                    <ContactShadows opacity={0.5} scale={18} blur={3.2} far={18} resolution={1536} position={[0, -0.001, 0]} />

                    <React.Suspense fallback={<Loader />}>
                        <Bounds fit clip margin={1.2}>
                            <RobotModel onRootReady={setSceneRoot} />
                        </Bounds>
                    </React.Suspense>

                    {hovered && <BoxHighlight target={hovered} color="#60a5fa" />}
                    {selected && <BoxHighlight target={selected} color="#22d3ee" />}

                    {selected && (
                        // @ts-expect-error: Ref typing from drei is stricter than our lightweight local type
                        <TransformControls ref={transformRef} object={selected} mode="rotate" showX showY showZ />
                    )}

                    <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
                        <GizmoViewport labelColor="white" axisHeadScale={1} />
                    </GizmoHelper>

                    {/* @ts-expect-error: Ref typing from drei is stricter than our lightweight local type */}
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
                        Tip: If your robot has named joints like &quot;Shoulder_L&quot;, &quot;Elbow_R&quot;, pick those to limit changes to arms.
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
                helper.geometry.dispose();
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
                    const typeLabel = n instanceof THREE.Bone ? "Bone" : n instanceof THREE.Mesh ? "Mesh" : "Node";
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


