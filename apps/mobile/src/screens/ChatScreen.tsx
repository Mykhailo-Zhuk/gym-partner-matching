import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ChatMessagePayload as MsgPayload, MatchListItem } from '../api';
import { authApi } from '../api';
import { useAuth } from '../auth';
import { useSocket } from '../hooks/useSocket';
import { Loading, Screen } from '../ui';

interface Props {
  matchId: string;
  match: MatchListItem | null;
  onBack: () => void;
  onSchedulePress?: (match: MatchListItem) => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

interface Props {
  matchId: string;
  onBack: () => void;
}

export function ChatScreen({ matchId, match: matchProp, onBack, onSchedulePress }: Props) {
  const { token } = useAuth();
  const api = authApi(token!);
  const { connected, lastMessage } = useSocket(token);
  const [messages, setMessages] = useState<MsgPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const match = matchProp;

  // Load messages
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const msgs = await api.getMessages(matchId);
      setMessages(msgs.items);
      setCursor(msgs.nextCursor);
      setHasMore(msgs.nextCursor !== null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося завантажити');
    } finally {
      setLoading(false);
    }
  }, [api, matchId]);

  useEffect(() => { void load(); }, [load]);

  // Append realtime message
  useEffect(() => {
    if (!lastMessage || lastMessage.matchId !== matchId) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === lastMessage.id)) return prev;
      return [...prev, lastMessage];
    });
  }, [lastMessage, matchId]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (messages.length === 0) return;
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  async function loadMore() {
    if (!cursor || !hasMore) return;
    try {
      const res = await api.getMessages(matchId, cursor);
      setMessages((prev) => [...res.items, ...prev]);
      setCursor(res.nextCursor);
      setHasMore(res.nextCursor !== null);
    } catch {
      // silent
    }
  }

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setText('');
    setSending(true);
    try {
      const msg = await api.sendMessage(matchId, body);
      setMessages((prev) => [...prev, msg]);
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося надіслати');
      setText(body); // restore
    } finally {
      setSending(false);
    }
  }

  if (loading) return <Screen><Loading /></Screen>;

  const partner = match?.partner;
  const myId = null; // TODO: get from token

  function renderItem({ item }: { item: MsgPayload }) {
    const isMe = item.senderId !== null; // TODO: compare with actual userId
    const isSystem = item.type === 'SYSTEM';
    const isImage = item.type === 'IMAGE';

    if (isSystem) {
      return (
        <View style={s.systemMsg}>
          <Text style={s.systemText}>{item.body}</Text>
        </View>
      );
    }

    return (
      <View style={[s.bubbleRow, isMe ? s.bubbleRowMe : s.bubbleRowThem]}>
        {!isMe && (
          <View style={s.bubbleAvatar}>
            <Text style={s.bubbleInitial}>{(item.senderName ?? '?')[0]}</Text>
          </View>
        )}
        <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
          {isImage && item.mediaUrl && (
            <Image source={{ uri: item.mediaUrl }} style={s.chatImage} />
          )}
          {item.body && <Text style={s.bubbleText}>{item.body}</Text>}
          <Text style={[s.bubbleTime, isMe && s.bubbleTimeMe]}>{formatTime(item.createdAt)}</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </Pressable>
        <View style={s.headerInfo}>
          <Text style={s.headerName}>{partner?.name ?? 'Чат'}</Text>
          <Text style={s.headerStatus}>{connected ? '🟢 онлайн' : '⚫ офлайн'}</Text>
        </View>
      </View>

      {/* Messages */}
      {error && <Text style={s.error}>{error}</Text>}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={(m) => m.id}
        contentContainerStyle={s.messageList}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        inverted={false}
      />

      {/* Input */}
      <View style={s.inputRow}>
        <TextInput
          style={s.textInput}
          placeholder="Повідомлення…"
          placeholderTextColor="#8b93a7"
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => void send()}
          returnKeyType="send"
          editable={!sending}
        />
        <Pressable style={[s.sendBtn, !text.trim() && s.sendBtnDisabled]} onPress={() => void send()} disabled={!text.trim() || sending}>
          <Text style={s.sendBtnText}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a2233', paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#2a3554' },
  backBtn: { marginRight: 12 },
  backArrow: { color: '#4f8cff', fontSize: 22 },
  headerInfo: { flex: 1 },
  headerName: { color: '#e8ecf4', fontSize: 17, fontWeight: '700' },
  headerStatus: { color: '#8b93a7', fontSize: 12 },
  messageList: { padding: 16, paddingBottom: 8 },
  bubbleRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end' },
  bubbleRowMe: { justifyContent: 'flex-end' },
  bubbleRowThem: { justifyContent: 'flex-start' },
  bubbleAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2a3554', alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  bubbleInitial: { color: '#e8ecf4', fontSize: 12, fontWeight: '700' },
  bubble: { maxWidth: '72%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  bubbleMe: { backgroundColor: '#4f8cff', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#1a2233', borderBottomLeftRadius: 4 },
  bubbleText: { color: '#e8ecf4', fontSize: 15, lineHeight: 20 },
  bubbleTime: { color: 'rgba(139,147,167,0.7)', fontSize: 11, marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.6)' },
  chatImage: { width: 200, height: 150, borderRadius: 10, marginBottom: 4 },
  systemMsg: { alignItems: 'center', marginVertical: 8 },
  systemText: { color: '#8b93a7', fontSize: 13, fontStyle: 'italic' },
  error: { color: '#e5534b', fontSize: 13, padding: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#1a2233', borderTopWidth: 1, borderTopColor: '#2a3554', paddingBottom: 28 },
  textInput: { flex: 1, backgroundColor: '#0f1420', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, color: '#e8ecf4', fontSize: 15, marginRight: 10 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#4f8cff', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
