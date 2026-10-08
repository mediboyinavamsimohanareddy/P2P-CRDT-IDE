import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Sparkles, Play, Check, X, RefreshCw, GitMerge, Layers, ShieldCheck, ArrowRightLeft, Code2, Users, Award, TrendingUp, Hash, Database, Wifi, WifiOff, Clock, HardDrive } from 'lucide-react';
import { LocalPersistenceManager, OfflineSessionDraft } from '../services/LocalPersistenceManager';
import { VerificationRunner, StageResult } from '../core/merge/VerificationRunner';
import { MergeHistoryStore } from '../core/merge/MergeHistoryStore';
import { OperationLogStore } from '../core/security/OperationLogStore';
import { YjsCrdtEngine } from '../core/crdt/CrdtEngine';
import { OverlapConflictDetector } from '../core/merge/OverlapConflictDetector';
import { SemanticConflictResolver } from '../core/merge/SemanticConflictResolver';
import { OllamaLocalProvider } from '../core/ai/AIProvider';
import { CollaborationManager } from '../core/sync/CollaborationManager';
import { Conflict, Proposal } from '@decentraide/shared';
import { JavaAstParser, SemanticASTConflict } from '../core/ast/JavaAstParser';
import {
  ThreePeerConsensusPredictor,
  ConsensusPredictionResult,
  PeerCodeSubmission,
} from '../core/consensus/ThreePeerConsensusPredictor';

export interface ConflictResolutionViewProps {
  crdtEngine?: YjsCrdtEngine;
  activeFilePath?: string;
  activeCode?: string;
  onApplyResolvedCode?: (resolvedCode: string) => void;
}

export interface PeerVersionCard {
  peerId: string;
  displayName: string;
  codeSnippet: string;
  aValue: string;
  integerValue: number;
  isHost: boolean;
}

const DEFAULT_3_LAPTOPS: PeerVersionCard[] = [
  {
    peerId: 'laptop-1-host',
    displayName: 'Laptop 1 (Host)',
    codeSnippet: 'int a = 10;',
    aValue: '10',
    integerValue: 20,
    isHost: true,
  },
  {
    peerId: 'laptop-2-peer',
    displayName: 'Laptop 2',
    codeSnippet: 'int a = 20;',
    aValue: '20',
    integerValue: 50,
    isHost: false,
  },
  {
    peerId: 'laptop-3-peer',
    displayName: 'Laptop 3',
    codeSnippet: 'int a = 30;',
    aValue: '30',
    integerValue: 30,
    isHost: false,
  },
];

export const ConflictResolutionView: React.FC<ConflictResolutionViewProps> = ({
  crdtEngine,
  activeFilePath = 'Main.java',
  activeCode,
  onApplyResolvedCode,
}) => {
  const [activeConflict, setActiveConflict] = useState<Conflict | null>(
    OverlapConflictDetector.getInstance().getLatest()
  );
  const [astConflict, setAstConflict] = useState<SemanticASTConflict | null>(
    OverlapConflictDetector.getInstance().getLatestAstConflict()
  );

  const [peerVersions, setPeerVersions] = useState<PeerVersionCard[]>(DEFAULT_3_LAPTOPS);
  const [consensusPrediction, setConsensusPrediction] = useState<ConsensusPredictionResult | null>(() => {
    try {
      return ThreePeerConsensusPredictor.predict(
        DEFAULT_3_LAPTOPS.map((c) => ({
          peerId: c.peerId,
          displayName: c.displayName,
          codeSnippet: c.codeSnippet,
          integerValue: c.integerValue,
        }))
      );
    } catch {
      return null;
    }
  });

  const recalculateConsensus = (cards: PeerVersionCard[]) => {
    if (cards.length === 0) return;
    const submissions: PeerCodeSubmission[] = cards.map((c) => ({
      peerId: c.peerId,
      displayName: c.displayName,
      codeSnippet: c.codeSnippet,
      integerValue: c.integerValue,
    }));
    try {
      const pred = ThreePeerConsensusPredictor.predict(submissions);
      setConsensusPrediction(pred);
    } catch (e) {
      console.error('[Consensus] Prediction failed:', e);
    }
  };

  const handleUpdatePeerInteger = (idx: number, newVal: number) => {
    setPeerVersions((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], integerValue: newVal };
      recalculateConsensus(copy);
      return copy;
    });
  };

  const handleUpdatePeerCode = (idx: number, newCode: string) => {
    setPeerVersions((prev) => {
      const copy = [...prev];
      const match = newCode.match(/(?:int|double|var)\s+a\s*=\s*(-?\d+)/);
      copy[idx] = {
        ...copy[idx],
        codeSnippet: newCode,
        aValue: match ? match[1] : copy[idx].aValue,
      };
      recalculateConsensus(copy);
      return copy;
    });
  };

  const [isOfflineSimulated, setIsOfflineSimulated] = useState<boolean>(false);
  const [offlineDraftStored, setOfflineDraftStored] = useState<OfflineSessionDraft | null>(() => {
    try {
      return new LocalPersistenceManager('.').getDevToolsOfflineDraft();
    } catch {
      return null;
    }
  });
  const [timeoutNotice, setTimeoutNotice] = useState<string | null>(null);

  const handleSimulateGoOffline = () => {
    setIsOfflineSimulated(true);
    const persistence = new LocalPersistenceManager('.');
    const activeRoomId = CollaborationManager.getInstance().getPeerStore().getRoomId() || 'DB-OFFLINE';
    const draft: OfflineSessionDraft = {
      roomId: activeRoomId,
      peerId: 'laptop-3-user',
      displayName: 'Laptop 3 (Offline User)',
      code: peerVersions[2]?.codeSnippet || 'int a = 30;',
      integerValue: peerVersions[2]?.integerValue ?? 30,
      filePath: activeFilePath,
      isHost: false,
      lastSavedAt: Date.now(),
      isOffline: true,
    };
    persistence.saveDevToolsOfflineDraft(draft);
    setOfflineDraftStored(draft);
    setTimeoutNotice(
      `Saved to LocalStorage under keys [decentraide:offline-session] & [decentraide:active-room-id: ${activeRoomId}]. Open F12 DevTools -> Application -> Local Storage to inspect!`
    );
  };

  const handleSimulateInternetRestored = async () => {
    setIsOfflineSimulated(false);
    const persistence = new LocalPersistenceManager('.');
    const draft = persistence.getDevToolsOfflineDraft() || offlineDraftStored;
    if (!draft) return;

    // Directly rejoin the room
    const collab = CollaborationManager.getInstance();
    await collab.startSession(draft.roomId, { isHost: draft.isHost });

    // Move / forward code to Conflict Detector against the other 2 laptops
    const conflict = collab.forwardOfflineCodeToConflictDetector(draft.code, draft.filePath, draft.integerValue);
    setActiveConflict(conflict);

    // Update peer cards to show all 3 laptops tested against each other
    const mapped: PeerVersionCard[] = [
      peerVersions[0] || { peerId: 'laptop-1-host', displayName: 'Laptop 1 (Host)', codeSnippet: 'int a = 10;', aValue: '10', integerValue: 20, isHost: true },
      peerVersions[1] || { peerId: 'laptop-2-peer', displayName: 'Laptop 2', codeSnippet: 'int a = 20;', aValue: '20', integerValue: 50, isHost: false },
      {
        peerId: draft.peerId || 'laptop-3-peer',
        displayName: 'Laptop 3 (Reconnected)',
        codeSnippet: draft.code,
        aValue: (draft.code.match(/(?:int|double|var)\s+a\s*=\s*(-?\d+)/) || [])[1] || '30',
        integerValue: draft.integerValue ?? 30,
        isHost: false,
      },
    ];
    setPeerVersions(mapped);
    recalculateConsensus(mapped);

    setTimeoutNotice(
      `Internet recovered! Fetched from LocalStorage, auto-rejoined room "${draft.roomId}", and code forwarded to Conflict Detector against the other 2 laptops.`
    );
  };

  const handleSimulatePeer3Timeout = () => {
    const peer3Id = peerVersions[2]?.peerId || 'laptop-3-peer';
    // Call conflict detector timeout handler
    OverlapConflictDetector.getInstance().handlePeerOfflineTimeout(peer3Id);

    // Filter peer versions down to only the other 2 laptops
    const twoLaptops = peerVersions.slice(0, 2);
    setPeerVersions(twoLaptops);
    recalculateConsensus(twoLaptops);

    setTimeoutNotice(
      `Laptop 3 remained offline past timeout threshold (>20s). Only the other 2 laptops' code has moved forward to the Conflict Detector!`
    );
  };

  const [aiProposal, setAiProposal] = useState<Proposal | null>(null);
  const [proposedCode, setProposedCode] = useState<string>(
    activeCode || `class Main {\n    public static void main(String[] args) {\n        int a = 100; // Calculated correct 'a' value for result = 100\n        int result = a;\n        System.out.println("Verified correct a = " + a);\n    }\n}`
  );
  const [selectedPeerId, setSelectedPeerId] = useState<string>('AI');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isFetchingPeers, setIsFetchingPeers] = useState(false);
  const [allPassed, setAllPassed] = useState(false);
  const [isStaged, setIsStaged] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [stages, setStages] = useState<StageResult[]>([
    { stage: 'syntax', label: 'Syntax Validation', status: 'idle' },
    { stage: 'ast', label: 'AST Scope Analysis', status: 'idle' },
    { stage: 'static', label: 'Static Analysis', status: 'idle' },
    { stage: 'typecheck', label: 'Type Check', status: 'idle' },
    { stage: 'compile', label: 'mvn compile', status: 'idle' },
    { stage: 'tests', label: 'mvn test', status: 'idle' },
  ]);

  // Subscribe to live conflicts
  useEffect(() => {
    const detector = OverlapConflictDetector.getInstance();
    const updateConflict = (conflict: Conflict, astC?: SemanticASTConflict | null) => {
      setActiveConflict(conflict);
      setAstConflict(astC || null);
      if (conflict.versions && conflict.versions.length > 0) {
        const roomPeers = CollaborationManager.getInstance().getPeerStore().getPeers();
        const mapped: PeerVersionCard[] = conflict.versions.map((v, i) => {
          const aMatch = v.codeSnippet.match(/(?:int|double|var)\s+a\s*=\s*(-?\d+)/);
          const matchedPeer = roomPeers.find((rp) => rp.id === v.authorId);
          const displayName = matchedPeer
            ? matchedPeer.displayName
            : i === 0
            ? 'Laptop 1 (Host)'
            : `Laptop ${i + 1} (${v.authorId.substring(0, 6)})`;
          const defaultInt = aMatch ? parseInt(aMatch[1], 10) : (i + 1) * 20;

          return {
            peerId: v.authorId,
            displayName,
            codeSnippet: v.codeSnippet,
            aValue: aMatch ? aMatch[1] : 'Unknown',
            integerValue: defaultInt,
            isHost: matchedPeer ? matchedPeer.role === 'Host' : i === 0,
          };
        });
        setPeerVersions(mapped);
        recalculateConsensus(mapped);
      }
      generateAiSolution(conflict, astC);
    };

    const unsub = detector.subscribe(updateConflict);
    const latest = detector.getLatest();
    if (latest) {
      setActiveConflict(latest);
      const astC = detector.getLatestAstConflict();
      setAstConflict(astC);
      if (latest.versions && latest.versions.length > 0) {
        const roomPeers = CollaborationManager.getInstance().getPeerStore().getPeers();
        const mapped: PeerVersionCard[] = latest.versions.map((v, i) => {
          const aMatch = v.codeSnippet.match(/(?:int|double|var)\s+a\s*=\s*(-?\d+)/);
          const matchedPeer = roomPeers.find((rp) => rp.id === v.authorId);
          const displayName = matchedPeer
            ? matchedPeer.displayName
            : i === 0
            ? 'Laptop 1 (Host)'
            : `Laptop ${i + 1} (${v.authorId.substring(0, 6)})`;
          const defaultInt = aMatch ? parseInt(aMatch[1], 10) : (i + 1) * 20;

          return {
            peerId: v.authorId,
            displayName,
            codeSnippet: v.codeSnippet,
            aValue: aMatch ? aMatch[1] : 'Unknown',
            integerValue: defaultInt,
            isHost: matchedPeer ? matchedPeer.role === 'Host' : i === 0,
          };
        });
        setPeerVersions(mapped);
        recalculateConsensus(mapped);
      }
      generateAiSolution(latest, astC);
    }

    return () => unsub();
  }, []);

  const fetchPeerVersions = async () => {
    setIsFetchingPeers(true);
    try {
      const collab = CollaborationManager.getInstance();
      const peerStates = await collab.fetchPeerState(undefined, activeFilePath);
      const localCode = collab.getCrdtEngine().getText(activeFilePath).toString();

      const versionsList: { authorId: string; opHash: string; codeSnippet: string; line: number }[] = [
        { authorId: collab.getIdentity().peerId, opHash: 'local', codeSnippet: localCode, line: 1 },
      ];

      peerStates.forEach((ps, index) => {
        versionsList.push({
          authorId: ps.peerId || `peer-${index + 2}`,
          opHash: `remote-${index}`,
          codeSnippet: ps.code || 'int a = 20;',
          line: 1,
        });
      });

      const roomPeers = CollaborationManager.getInstance().getPeerStore().getPeers();
      const mappedCards: PeerVersionCard[] = versionsList.map((v, i) => {
        const aMatch = v.codeSnippet.match(/(?:int|double|var)\s+a\s*=\s*(-?\d+)/);
        const matchedPeer = roomPeers.find((rp) => rp.id === v.authorId);
        const displayName = matchedPeer
          ? matchedPeer.displayName
          : i === 0
          ? 'Laptop 1 (Host)'
          : `Laptop ${i + 1} (${v.authorId.substring(0, 6)})`;
        const defaultInt = aMatch ? parseInt(aMatch[1], 10) : (i + 1) * 20;

        return {
          peerId: v.authorId,
          displayName,
          codeSnippet: v.codeSnippet,
          aValue: aMatch ? aMatch[1] : 'Unknown',
          integerValue: defaultInt,
          isHost: matchedPeer ? matchedPeer.role === 'Host' : i === 0,
        };
      });
      setPeerVersions(mappedCards);
      recalculateConsensus(mappedCards);

      const currentConflict: Conflict = {
        id: `conflict-${Date.now()}`,
        filePath: activeFilePath,
        detectedAt: Date.now(),
        baseSnippet: localCode,
        versions: versionsList,
      };

      const computedAst = JavaAstParser.compareAST(activeFilePath, localCode, localCode, versionsList[1]?.codeSnippet || '');
      setActiveConflict(currentConflict);
      setAstConflict(computedAst);
      await generateAiSolution(currentConflict, computedAst);
    } catch {
      // Fallback
    } finally {
      setIsFetchingPeers(false);
    }
  };

  const generateAiSolution = async (conflict: Conflict, astC?: SemanticASTConflict | null) => {
    setIsGeneratingAi(true);
    try {
      const resolver = new SemanticConflictResolver(new OllamaLocalProvider());
      const proposal = await resolver.resolveConflict(conflict, astC);
      setAiProposal(proposal);
      setProposedCode(proposal.proposedCode);
    } catch {
      // Fallback
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleRunVerification = async () => {
    setIsVerifying(true);
    setAllPassed(false);
    setIsStaged(false);

    const runner = new VerificationRunner();
    runner.onProgress((updatedStages) => {
      setStages(updatedStages);
    });

    const res = await runner.runVerification(proposedCode, activeFilePath);

    setIsVerifying(false);
    setAllPassed(res);
  };

  const handleAcceptAndSyncMerge = async () => {
    if (!allPassed) return;
    setIsBroadcasting(true);

    const collab = CollaborationManager.getInstance();

    if (crdtEngine && activeFilePath) {
      const ytext = crdtEngine.getText(activeFilePath);
      crdtEngine.getDoc().transact(() => {
        if (ytext.length > 0) ytext.delete(0, ytext.length);
        ytext.insert(0, proposedCode);
      }, 'conflict-resolution-applied');
    }

    if (onApplyResolvedCode) {
      onApplyResolvedCode(proposedCode);
    }

    await collab.broadcastVerifiedMerge(undefined, activeFilePath);

    const currentHash = crdtEngine ? crdtEngine.computeWorkspaceHash() : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    const connectedCount = CollaborationManager.getInstance().getPeerStore().getConnectedPeerCount();
    const peerInvolvedLabel = `${connectedCount} Connected ${connectedCount === 1 ? 'Peer' : 'Peers'} (Dynamic)`;

    const nextMergeNum = MergeHistoryStore.getInstance().getRecords().length + 1;
    MergeHistoryStore.getInstance().addRecord({
      id: `SYNC-#${String(nextMergeNum).padStart(4, '0')}`,
      file: activeFilePath,
      operationType: 'Dynamic Multi-Peer AI Semantic Merge',
      peerInvolved: peerInvolvedLabel,
      syncStatus: 'SYNCED',
      conflictStatus: 'RESOLVED',
      verificationStatus: 'PASSED',
      timestamp: new Date().toLocaleTimeString(),
      stateHash: currentHash,
    });

    OperationLogStore.getInstance().logAppliedOp(`Host Peer (${peerInvolvedLabel})`, 'UPDATE', activeFilePath);

    setIsBroadcasting(false);
    setIsStaged(true);
  };

  return (
    <div className="flex-1 bg-bg-darkest text-gray-200 p-6 flex flex-col gap-6 overflow-y-auto font-sans">
      {/* Top Banner & Header */}
      <div className="bg-bg-dark border border-status-warn/30 rounded-lg p-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-full bg-status-warn/10 text-status-warn border border-status-warn/20">
            <GitMerge className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-gray-100 flex items-center gap-2">
                <span>Multi-Peer Conflict Manager</span>
                <span className="text-gray-500 font-normal">/</span>
                <span className="text-accent-mint">{activeConflict?.filePath || activeFilePath}</span>
              </h1>
              <span className="bg-status-pass/20 text-status-pass text-[10px] px-2 py-0.5 rounded font-mono font-bold border border-status-pass/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Ollama Mistral / Live 'a' Value Evaluation
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Side-by-side analysis of 'a' values across all connected laptops. Ollama evaluates which user provided the correct 'a' value, or calculates the correct 'a' if all are wrong.
            </p>
          </div>
        </div>

        <button
          onClick={fetchPeerVersions}
          disabled={isFetchingPeers}
          className="bg-bg-panel hover:bg-bg-hover text-gray-200 font-semibold px-3 py-1.5 rounded text-xs border border-border-subtle flex items-center gap-1.5 shadow disabled:opacity-40"
        >
          <ArrowRightLeft className={`w-3.5 h-3.5 text-accent-mint ${isFetchingPeers ? 'animate-spin' : ''}`} />
          <span>{isFetchingPeers ? 'Fetching All Peers...' : 'Fetch All Connected Peer Versions'}</span>
        </button>
      </div>

      {/* Feature 2: DevTools-Visible LocalStorage System, Auto-Rejoin & Offline Timeout Control */}
      <div className="bg-bg-dark border border-status-info/30 rounded-lg p-4 flex flex-col gap-3 shadow-md bg-gradient-to-r from-bg-dark to-status-info/5">
        <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-status-info" />
            <span className="font-semibold text-xs text-gray-100">
              DevTools LocalStorage System &amp; Offline Auto-Rejoin Pipeline
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
              isOfflineSimulated
                ? 'bg-status-warn/20 text-status-warn border-status-warn/30'
                : 'bg-status-pass/20 text-status-pass border-status-pass/30'
            }`}>
              {isOfflineSimulated ? 'OFFLINE DRAFT SAVED' : 'ONLINE / CONNECTED'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSimulateGoOffline}
              className="bg-bg-darkest hover:bg-bg-panel text-status-warn border border-status-warn/40 px-2.5 py-1.5 rounded text-xs flex items-center gap-1.5 font-semibold transition-all shadow"
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span>Simulate Go Offline (Save to LocalStorage)</span>
            </button>

            <button
              onClick={handleSimulateInternetRestored}
              className="bg-accent-mint hover:bg-accent-mintHover text-bg-darkest px-3 py-1.5 rounded text-xs flex items-center gap-1.5 font-bold transition-all shadow"
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Internet Restored (Auto-Rejoin &amp; Test vs 2 Laptops)</span>
            </button>

            <button
              onClick={handleSimulatePeer3Timeout}
              className="bg-status-error/15 hover:bg-status-error/25 text-status-error border border-status-error/40 px-2.5 py-1.5 rounded text-xs flex items-center gap-1.5 font-semibold transition-all shadow"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Peer 3 Offline Timeout (Advance 2 Laptops Only)</span>
            </button>
          </div>
        </div>

        {/* DevTools LocalStorage Inspection Keys Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px] font-mono bg-bg-darkest p-3 rounded border border-border-subtle">
          <div className="flex flex-col gap-0.5">
            <span className="text-gray-400 font-sans font-semibold flex items-center gap-1">
              <Database className="w-3 h-3 text-status-info" />
              Key: <code className="text-accent-mint">decentraide:active-room-id</code>
            </span>
            <span className="text-gray-200 truncate">
              {offlineDraftStored?.roomId || CollaborationManager.getInstance().getPeerStore().getRoomId() || 'DB-OFFLINE'}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-gray-400 font-sans font-semibold flex items-center gap-1">
              <Database className="w-3 h-3 text-status-info" />
              Key: <code className="text-accent-mint">decentraide:cached-code</code>
            </span>
            <span className="text-gray-200 truncate">
              {offlineDraftStored?.code || peerVersions[2]?.codeSnippet || 'int a = 30;'}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-gray-400 font-sans font-semibold flex items-center gap-1">
              <Database className="w-3 h-3 text-status-info" />
              Key: <code className="text-accent-mint">decentraide:offline-session</code>
            </span>
            <span className="text-gray-200 truncate">
              {offlineDraftStored ? JSON.stringify({ roomId: offlineDraftStored.roomId, code: offlineDraftStored.code, integerValue: offlineDraftStored.integerValue }) : 'Inspect in F12 -> Application -> Local Storage'}
            </span>
          </div>
        </div>

        {/* Status Notification Banner */}
        {timeoutNotice && (
          <div className="bg-bg-darkest/90 border border-status-info/40 text-status-info p-2.5 rounded text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{timeoutNotice}</span>
          </div>
        )}
      </div>

      {/* 3-Laptop Multi-Replica Cards with Code & Integer Values */}
      <div className="flex items-center justify-between text-xs font-semibold text-gray-300">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-status-info" />
          <span>3-Laptop Replica Submissions (Code + User-Assigned Integer Value):</span>
        </div>
        <span className="text-[11px] text-gray-400 font-mono">
          Each user gives code and an integer value
        </span>
      </div>

      {peerVersions.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {peerVersions.map((card, idx) => {
            const isWinner = consensusPrediction && consensusPrediction.predictedWinningCode === card.codeSnippet;
            const candidate = consensusPrediction?.candidates.find((c) => c.normalizedLine === ThreePeerConsensusPredictor.normalizeLine(card.codeSnippet));

            return (
              <div
                key={card.peerId + idx}
                onClick={() => {
                  setSelectedPeerId(card.peerId);
                  setProposedCode(card.codeSnippet);
                }}
                className={`bg-bg-dark border rounded-lg p-3 flex flex-col gap-2.5 transition-all ${
                  isWinner
                    ? 'border-accent-mint/70 bg-accent-mint/10 shadow-lg ring-1 ring-accent-mint/40'
                    : selectedPeerId === card.peerId
                    ? 'border-status-info bg-status-info/10 shadow-md'
                    : 'border-border-subtle hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between text-xs border-b border-border-subtle pb-2">
                  <div className="flex items-center gap-1.5 font-semibold text-gray-200">
                    <Layers className="w-3.5 h-3.5 text-status-info" />
                    <span>{card.displayName}</span>
                    {card.isHost && (
                      <span className="text-[9px] bg-accent-purple/20 text-accent-purple border border-accent-purple/40 px-1.5 py-0.2 rounded font-mono">
                        Host
                      </span>
                    )}
                  </div>
                  {isWinner && (
                    <span className="text-[10px] text-accent-mint font-bold bg-accent-mint/20 border border-accent-mint/40 px-2 py-0.5 rounded flex items-center gap-1">
                      <Award className="w-3 h-3" /> Winner
                    </span>
                  )}
                </div>

                {/* User-defined Integer Value Input */}
                <div className="flex items-center justify-between bg-bg-darkest px-2.5 py-1.5 rounded border border-border-subtle">
                  <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                    <Hash className="w-3 h-3 text-status-warn" />
                    Integer Value:
                  </span>
                  <input
                    type="number"
                    value={card.integerValue}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      handleUpdatePeerInteger(idx, isNaN(val) ? 0 : val);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-16 bg-bg-panel border border-border-subtle text-accent-mint font-mono font-bold text-xs px-2 py-0.5 rounded text-right focus:border-accent-mint outline-none"
                  />
                </div>

                {/* Code Line Input / Snippet */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold">Submitted Code Line:</span>
                  <input
                    type="text"
                    value={card.codeSnippet}
                    onChange={(e) => handleUpdatePeerCode(idx, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="text-[11px] font-mono bg-bg-darkest p-2 rounded text-gray-200 border border-border-subtle focus:border-accent-mint outline-none w-full"
                    placeholder="e.g. int a = 20;"
                  />
                </div>

                {/* Probability & Frequency Stats */}
                {candidate && (
                  <div className="pt-1 border-t border-border-subtle flex items-center justify-between text-[10px] font-mono text-gray-400">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-status-info" />
                      Prob: <strong className="text-gray-200">{candidate.probabilityPercent}%</strong>
                    </span>
                    <span>
                      Majority: <strong className="text-gray-200">{candidate.majorityPercentage}%</strong>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 3-Laptop Consensus Engine: Majority & Probability Prediction Widget */}
      {consensusPrediction && (
        <div className="bg-bg-dark border border-accent-mint/30 rounded-lg p-3.5 flex flex-col gap-3 shadow-md bg-gradient-to-r from-bg-dark to-accent-mint/5">
          <div className="flex items-center justify-between border-b border-border-subtle pb-2">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-accent-mint" />
              <span className="font-semibold text-xs text-gray-200">
                3-Laptop Consensus Prediction (Majority &amp; Probability-Based)
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent-mint/20 text-accent-mint font-bold border border-accent-mint/30">
                {consensusPrediction.selectionBasis}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-status-pass font-bold">
                Accuracy Confidence: {consensusPrediction.accuracyConfidence}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
            <div className="md:col-span-2 flex flex-col gap-1.5">
              <div className="text-[11px] text-gray-300">
                <span className="font-semibold text-gray-400">Strict Rule Guarantee:</span>{' '}
                <span className="text-accent-mint font-semibold">
                  Accurately predicted strictly and ONLY among the lines of code submitted by the 3 users.
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-sans leading-relaxed">
                {consensusPrediction.rationale}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] font-semibold text-gray-400">Predicted Winning Line:</span>
                <code className="text-xs font-mono font-bold text-accent-mint bg-bg-darkest px-2.5 py-1 rounded border border-accent-mint/30">
                  {consensusPrediction.predictedWinningCode}
                </code>
              </div>
            </div>

            <div className="flex flex-col gap-2 items-end justify-center">
              <button
                onClick={() => {
                  const updated = ThreePeerConsensusPredictor.applyWinnerToTemplate(
                    proposedCode,
                    consensusPrediction.predictedWinningCode
                  );
                  setProposedCode(updated);
                }}
                className="w-full bg-accent-mint hover:bg-accent-mintHover text-bg-darkest font-bold px-3 py-2 rounded text-xs flex items-center justify-center gap-1.5 shadow transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Adopt Predicted Winner</span>
              </button>
            </div>
          </div>

          {/* Candidate Probability Distribution Breakdown Table */}
          <div className="border-t border-border-subtle pt-2">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
              Candidate Probability &amp; Majority Breakdown (Strict 3-User Candidates):
            </span>
            <div className="grid grid-cols-3 gap-2">
              {consensusPrediction.candidates.map((cand, cIdx) => (
                <div
                  key={cand.normalizedLine + cIdx}
                  className={`p-2 rounded border text-[11px] font-mono flex flex-col gap-1 ${
                    cand.codeLine === consensusPrediction.predictedWinningCode
                      ? 'bg-accent-mint/10 border-accent-mint/40 text-gray-200'
                      : 'bg-bg-darkest border-border-subtle text-gray-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-200 truncate">{cand.codeLine}</span>
                    {cand.isMajorityWinner && (
                      <span className="text-[9px] bg-status-info/20 text-status-info px-1.5 py-0.2 rounded font-semibold">
                        Majority ({cand.userCount}/3)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400">
                    <span>Weight: {cand.totalIntegerWeight}</span>
                    <span className="font-semibold text-accent-mint">Prob: {cand.probabilityPercent}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AST Analysis Section */}
      <div className="bg-bg-dark border border-border-subtle rounded-lg p-3 flex flex-col gap-2 shadow">
        <div className="flex items-center gap-2 text-xs font-semibold text-status-info border-b border-border-subtle pb-1.5">
          <Code2 className="w-4 h-4 text-status-info" />
          <span>AST Scope &amp; 'a' Variable Value Verification</span>
        </div>
        <div className="text-[11px] font-mono bg-bg-darkest p-2.5 rounded border border-border-subtle flex flex-col gap-1 text-gray-300">
          <div>
            <span className="text-gray-400 font-semibold">Target Variable:</span>{' '}
            <span className="text-accent-mint font-bold">a</span> (evaluated across available peer submissions)
          </div>
          <div>
            <span className="text-gray-400 font-semibold">Submitted Values:</span>{' '}
            <span>{peerVersions.map((p) => `${p.displayName}: a=${p.aValue}`).join(' | ')}</span>
          </div>
          <div>
            <span className="text-gray-400 font-semibold">Verification Strategy:</span>{' '}
            <span className="text-status-warn">Checking which 'a' value yields target code logic; if none are correct, Ollama calculates the correct 'a' value.</span>
          </div>
        </div>
      </div>

      {/* AI Proposed Merge Block & Non-hardcoded Scoring */}
      <div className="bg-bg-dark border border-border-subtle rounded-lg p-4 flex flex-col gap-3 shadow-md">
        <div className="flex items-center justify-between border-b border-border-subtle pb-2">
          <div className="flex items-center gap-2 font-semibold text-xs text-gray-200">
            <Sparkles className="w-4 h-4 text-accent-mint" />
            <span>Ollama AI Correct 'a' Value Evaluation &amp; Resolution</span>
            {isGeneratingAi && <RefreshCw className="w-3.5 h-3.5 text-accent-mint animate-spin ml-2" />}
          </div>
          <span className="text-[11px] font-mono">
            {isStaged ? (
              <span className="text-status-pass font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                VERIFIED MERGE BROADCAST TO ALL CONNECTED PEERS
              </span>
            ) : allPassed ? (
              <span className="text-status-pass font-bold">✓ ALL VERIFICATION GATES PASSED</span>
            ) : isVerifying ? (
              <span className="text-status-warn">EXECUTING VERIFICATION GATES...</span>
            ) : (
              <span className="text-gray-500">Pending Verification</span>
            )}
          </span>
        </div>

        {/* AI Scoring Box */}
        {aiProposal && (
          <div className="bg-bg-panel p-3 rounded border border-accent-mint/20 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-accent-mint flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Calculated AI Confidence / Resolution Score:
              </span>
              <span className="font-bold font-mono text-status-pass text-sm">
                {aiProposal.confidence}%
              </span>
            </div>
            <p className="text-[11px] text-gray-300 leading-normal font-sans">
              <span className="font-semibold text-gray-400">Resolution Analysis &amp; Rationale:</span> {aiProposal.rationale}
            </p>
          </div>
        )}

        <textarea
          value={proposedCode}
          onChange={(e) => setProposedCode(e.target.value)}
          className="text-[12px] font-mono bg-bg-darkest p-3 rounded text-gray-200 border border-border-subtle leading-relaxed h-32 w-full outline-none focus:border-accent-mint resize-none"
        />

        {/* Verification Pipeline Stages & Prominent Trigger Buttons */}
        <div className="flex items-center justify-between bg-bg-panel p-3 rounded border border-border-subtle text-xs">
          <div className="flex items-center gap-3">
            {stages.map((stg) => (
              <span
                key={stg.stage}
                className={`flex items-center gap-1 text-[11px] font-mono ${
                  stg.status === 'passed'
                    ? 'text-status-pass font-semibold'
                    : stg.status === 'running'
                    ? 'text-status-warn animate-pulse font-semibold'
                    : 'text-gray-500'
                }`}
              >
                {stg.status === 'passed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                {stg.label}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunVerification}
              disabled={isVerifying}
              className="bg-status-info hover:bg-status-info/80 text-white font-semibold px-3 py-1.5 rounded text-xs flex items-center gap-1.5 shadow disabled:opacity-40"
            >
              {isVerifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isVerifying ? 'Running Gates...' : 'Run Verification Gates'}</span>
            </button>
            <button
              onClick={handleAcceptAndSyncMerge}
              disabled={!allPassed || isStaged || isBroadcasting}
              className="bg-accent-mint hover:bg-accent-mintHover text-bg-darkest font-bold px-4 py-1.5 rounded text-xs flex items-center gap-1.5 shadow disabled:opacity-40 transition-all"
            >
              {isBroadcasting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <GitMerge className="w-4 h-4" />
              )}
              <span>{isStaged ? 'Merge Synced to All Peers' : 'Accept & Broadcast Merge'}</span>
            </button>
            <button className="bg-bg-hover text-gray-400 px-3 py-1.5 rounded text-xs flex items-center gap-1">
              <X className="w-3.5 h-3.5" />
              <span>Reject</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
