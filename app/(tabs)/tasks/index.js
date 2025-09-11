// app/(tabs)/tasks/index.js
import { useEffect, useMemo, useState } from "react";
import {
  View, Text, TextInput, Pressable, FlatList, Alert
} from "react-native";
import { useLocalSearchParams } from "expo-router"; // 👈 NEW
import { auth, db } from "../../../src/firebase";
import {
  addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, Timestamp
} from "firebase/firestore";
import Card from "../../../components/Card";

const TYPES = ["water", "fertilize", "prune", "harvest", "custom"];

const todayISO = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
};
const startOfToday = () => { // 👈 NEW
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const isSameDay = (a, b) => {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};
const endOfToday = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

export default function TasksScreen() {
  const { focus } = useLocalSearchParams(); // 👈 NEW

  const [type, setType] = useState("water");
  const [due, setDue] = useState(todayISO()); // YYYY-MM-DD
  const [notes, setNotes] = useState("");
  const [tasks, setTasks] = useState([]);
  const [tab, setTab] = useState("today"); // "today" | "upcoming" | "overdue"

  // If navigated with ?focus=overdue, default to the Overdue tab
  useEffect(() => { // 👈 NEW
    if (focus === "overdue") setTab("overdue");
  }, [focus]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return; // gated by auth in layout, but guard anyway

    // Only the signed-in user's tasks, ordered by due date
    const q = query(
      collection(db, "tasks"),
      where("ownerId", "==", uid),
      orderBy("dueAt", "asc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.error(err);
        Alert.alert("Load error", "Could not load your tasks.");
      }
    );
    return unsub;
  }, []);

  const addTask = async () => {
    try {
      if (!due.match(/^\d{4}-\d{2}-\d{2}$/)) {
        Alert.alert("Invalid date", "Use format YYYY-MM-DD.");
        return;
      }
      const uid = auth.currentUser?.uid;
      if (!uid) {
        Alert.alert("Not signed in", "Please sign in to add tasks.");
        return;
      }
      const d = new Date(due + "T00:00:00");
      await addDoc(collection(db, "tasks"), {
        ownerId: uid, // <- scope to current user
        type,
        notes: notes.trim() || null,
        dueAt: Timestamp.fromDate(d),
        done: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNotes("");
      setDue(todayISO());
      setType("water");
      Alert.alert("Added", "Task created.");
    } catch (e) {
      Alert.alert("Add error", String(e?.message || e));
    }
  };

  const markDone = async (taskId) => {
    try {
      await updateDoc(doc(db, "tasks", taskId), {
        done: true,
        doneAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      Alert.alert("Update error", String(e?.message || e));
    }
  };

  const now = new Date();
  const filtered = useMemo(() => {
    return tasks.map((t) => {
      const dueAt =
        t.dueAt?.toDate?.() ??
        (t.dueAt?.seconds ? new Date(t.dueAt.seconds * 1000) : null);
      return { ...t, _dueAt: dueAt };
    });
  }, [tasks]);

  const todayTasks = filtered.filter(
    (t) => !t.done && t._dueAt && isSameDay(t._dueAt, now)
  );
  const upcomingTasks = filtered.filter(
    (t) => !t.done && t._dueAt && t._dueAt > endOfToday()
  );
  const overdueTasks = filtered.filter( // 👈 NEW
    (t) => !t.done && t._dueAt && t._dueAt < startOfToday()
  );

  return (
    <View style={{ padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "800" }}>Tasks</Text>

      {/* Add Task */}
      <Card>
        <Text style={{ fontWeight: "700", marginBottom: 8 }}>New Task</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {TYPES.map((t) => (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: "#e5dcc9",
                backgroundColor: type === t ? "#A26769" : "#fbf4eb"
              }}
            >
              <Text style={{ color: type === t ? "white" : "#4a3f35", fontWeight: "700" }}>
                {t}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          placeholder="Due date (YYYY-MM-DD)"
          value={due}
          onChangeText={setDue}
          style={input}
          placeholderTextColor="#9c8f86"
        />
        <TextInput
          placeholder="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          style={[input, { height: 80, textAlignVertical: "top" }]}
          multiline
          placeholderTextColor="#9c8f86"
        />
        <Pressable onPress={addTask} style={btnPrimary}>
          <Text style={btnPrimaryTxt}>Add Task</Text>
        </Pressable>
      </Card>

      {/* Tabs */}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Pressable
          onPress={() => setTab("today")}
          style={[tabBtn, tab === "today" && tabBtnActive]}
        >
          <Text style={[tabTxt, tab === "today" && tabTxtActive]}>
            Today {todayTasks.length ? `(${todayTasks.length})` : ""}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("upcoming")}
          style={[tabBtn, tab === "upcoming" && tabBtnActive]}
        >
          <Text style={[tabTxt, tab === "upcoming" && tabTxtActive]}>
            Upcoming {upcomingTasks.length ? `(${upcomingTasks.length})` : ""}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("overdue")}
          style={[tabBtn, tab === "overdue" && tabBtnActive]}
        >
          <Text style={[tabTxt, tab === "overdue" && tabTxtActive]}>
            Overdue {overdueTasks.length ? `(${overdueTasks.length})` : ""}
          </Text>
        </Pressable>
      </View>

      {tab === "today" ? (
        <TaskList data={todayTasks} markDone={markDone} emptyText="No tasks due today." />
      ) : tab === "upcoming" ? (
        <TaskList data={upcomingTasks} markDone={markDone} emptyText="No upcoming tasks." />
      ) : (
        <TaskList data={overdueTasks} markDone={markDone} emptyText="No overdue tasks 🎉" />
      )}
    </View>
  );
}

function TaskList({ data, markDone, emptyText }) {
  return (
    <FlatList
      data={data}
      keyExtractor={(it) => it.id}
      ListEmptyComponent={
        <Text style={{ color: "#6b5a50" }}>{emptyText || "No tasks here yet."}</Text>
      }
      renderItem={({ item }) => (
        <Card>
          <Text style={{ fontWeight: "700", marginBottom: 4 }}>
            {item.type?.toUpperCase() || "TASK"}
          </Text>
          {item._dueAt ? (
            <Text style={{ color: "#6b5a50", marginBottom: 6 }}>
              Due: {item._dueAt.toLocaleDateString()}
            </Text>
          ) : null}
          {item.notes ? <Text style={{ marginBottom: 8 }}>{item.notes}</Text> : null}
          {!item.done ? (
            <Pressable onPress={() => markDone(item.id)} style={btnSecondary}>
              <Text style={btnSecondaryTxt}>Mark Done</Text>
            </Pressable>
          ) : (
            <Text>✔ Done</Text>
          )}
        </Card>
      )}
    />
  );
}

const input = {
  backgroundColor: "white",
  borderWidth: 1,
  borderColor: "#e5dcc9",
  borderRadius: 10,
  padding: 10,
  marginBottom: 8
};

const btnPrimary = {
  backgroundColor: "#A26769",
  padding: 10,
  borderRadius: 10,
  alignItems: "center"
};
const btnPrimaryTxt = { color: "white", fontWeight: "700" };

const btnSecondary = {
  backgroundColor: "#fbf4eb",
  padding: 10,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: "#e5dcc9",
  alignItems: "center"
};
const btnSecondaryTxt = { color: "#4a3f35", fontWeight: "700" };

const tabBtn = {
  backgroundColor: "#fbf4eb",
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: "#e5dcc9"
};
const tabBtnActive = { backgroundColor: "#A26769", borderColor: "#A26769" };
const tabTxt = { color: "#4a3f35", fontWeight: "700" };
const tabTxtActive = { color: "white" };
