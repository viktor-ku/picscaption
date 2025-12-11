import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import {
  GripVertical,
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  Loader2,
  Asterisk,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "../../../convex/_generated/api";
import type { Id, Doc } from "../../../convex/_generated/dataModel";
import { Toggle } from "../Toggle";
import { DeleteMetaObjectModal } from "../DeleteMetaObjectModal";
import type { MetaObjectType } from "../../lib/settings";

type MetaObjectDoc = Doc<"metaObjects">;

interface SortableMetaItemProps {
  metaObject: MetaObjectDoc;
  isEditing: boolean;
  editName: string;
  editType: MetaObjectType;
  onToggleActive: (active: boolean) => void;
  onToggleRequired: (required: boolean) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onEditNameChange: (name: string) => void;
  onEditTypeChange: (type: MetaObjectType) => void;
  isSaving: boolean;
}

function SortableMetaItem({
  metaObject,
  isEditing,
  editName,
  editType,
  onToggleActive,
  onToggleRequired,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onEditNameChange,
  onEditTypeChange,
  isSaving,
}: SortableMetaItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: metaObject._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isEditing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex items-center gap-3 p-3 bg-white border border-primary rounded-lg ring-2 ring-primary/30"
      >
        <div className="p-1 text-gray-300">
          <GripVertical className="w-4 h-4" />
        </div>

        <input
          type="text"
          value={editName}
          onChange={(e) => onEditNameChange(e.target.value)}
          placeholder="Field name"
          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          autoFocus
        />

        <select
          value={editType}
          onChange={(e) => onEditTypeChange(e.target.value as MetaObjectType)}
          className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        >
          <option value="string">string</option>
          <option value="number">number</option>
        </select>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onMouseDownCapture={onCancelEdit}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
            disabled={isSaving}
          >
            <X className="w-4 h-4" />
          </button>
          <button
            type="button"
            onMouseDownCapture={onSaveEdit}
            disabled={!editName.trim() || isSaving}
            className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-md transition-colors cursor-pointer disabled:text-gray-300 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-white border rounded-lg ${
        isDragging ? "shadow-lg border-primary" : "border-gray-200"
      }`}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Name with required indicator */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className="text-sm font-medium text-gray-900">
          {metaObject.name}
        </span>
        {metaObject.required && (
          <Asterisk className="w-3 h-3 text-red-500" title="Required" />
        )}
      </div>

      {/* Type badge */}
      <span
        className={`px-2 py-0.5 text-xs font-medium rounded ${
          metaObject.type === "number"
            ? "text-blue-700 bg-blue-100"
            : "text-purple-700 bg-purple-100"
        }`}
      >
        {metaObject.type}
      </span>

      {/* Required toggle */}
      <div className="flex items-center gap-1" title="Required for import">
        <span className="text-xs text-gray-500">Req</span>
        <Toggle
          checked={metaObject.required}
          onChange={onToggleRequired}
          label=""
          size="sm"
        />
      </div>

      {/* Active toggle */}
      <div className="flex items-center gap-1" title="Include in imports">
        <span className="text-xs text-gray-500">Active</span>
        <Toggle
          checked={metaObject.active}
          onChange={onToggleActive}
          label=""
          size="sm"
        />
      </div>

      {/* Edit button */}
      <button
        type="button"
        onMouseDownCapture={onStartEdit}
        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
      >
        <Pencil className="w-4 h-4" />
      </button>

      {/* Delete button */}
      <button
        type="button"
        onMouseDownCapture={onDelete}
        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

interface MetaFieldsSettingsProps {
  userId: Id<"users"> | null;
}

export function MetaFieldsSettings({ userId }: MetaFieldsSettingsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<MetaObjectType>("string");
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<MetaObjectType>("string");
  const [isSaving, setIsSaving] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<MetaObjectDoc | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Convex queries and mutations
  const metaObjects = useQuery(
    api.metaObjects.listByUser,
    userId ? { userId } : "skip",
  );

  // Query image count for the delete target
  const deleteTargetImageCount = useQuery(
    api.metaObjects.getImageCount,
    deleteTarget && userId
      ? { id: deleteTarget._id, userId }
      : "skip",
  );

  const createMutation = useMutation(api.metaObjects.create);
  const updateMutation = useMutation(api.metaObjects.update);
  const toggleActiveMutation = useMutation(api.metaObjects.toggleActive);
  const toggleRequiredMutation = useMutation(api.metaObjects.toggleRequired);
  const reorderMutation = useMutation(api.metaObjects.reorder);
  const removeMutation = useMutation(api.metaObjects.remove);

  if (!userId) {
    return (
      <div className="text-sm text-gray-500">
        <p>Sign in or create a user to manage meta fields.</p>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!newName.trim() || !userId) return;

    setIsSaving(true);
    try {
      await createMutation({
        name: newName.trim(),
        type: newType,
        active: true,
        required: false,
        userId,
      });
      setNewName("");
      setNewType("string");
      setIsCreating(false);
      toast.success("Meta field created");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create meta field",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = (metaObject: MetaObjectDoc) => {
    setEditingId(metaObject._id);
    setEditName(metaObject.name);
    setEditType(metaObject.type);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditType("string");
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim() || !userId) return;

    setIsSaving(true);
    try {
      await updateMutation({
        id: editingId as Id<"metaObjects">,
        name: editName.trim(),
        type: editType,
        userId,
      });
      setEditingId(null);
      setEditName("");
      setEditType("string");
      toast.success("Meta field updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update meta field",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (
    metaObject: MetaObjectDoc,
    active: boolean,
  ) => {
    if (!userId) return;

    try {
      await toggleActiveMutation({
        id: metaObject._id,
        active,
        userId,
      });
    } catch (error) {
      toast.error("Failed to toggle meta field");
    }
  };

  const handleToggleRequired = async (
    metaObject: MetaObjectDoc,
    required: boolean,
  ) => {
    if (!userId) return;

    try {
      await toggleRequiredMutation({
        id: metaObject._id,
        required,
        userId,
      });
    } catch (error) {
      toast.error("Failed to toggle required state");
    }
  };

  const handleDeleteClick = (metaObject: MetaObjectDoc) => {
    setDeleteTarget(metaObject);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !userId) return;

    setIsDeleting(true);
    try {
      await removeMutation({
        id: deleteTarget._id,
        userId,
      });
      toast.success("Meta field deleted");
      setDeleteTarget(null);
    } catch (error) {
      toast.error("Failed to delete meta field");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteTarget(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !metaObjects || !userId) return;

    const oldIndex = metaObjects.findIndex((m) => m._id === active.id);
    const newIndex = metaObjects.findIndex((m) => m._id === over.id);

    const reordered = arrayMove(metaObjects, oldIndex, newIndex);
    const orderedIds = reordered.map((m) => m._id);

    try {
      await reorderMutation({
        orderedIds,
        userId,
      });
    } catch (error) {
      toast.error("Failed to reorder meta fields");
    }
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewName("");
    setNewType("string");
  };

  return (
    <>
      {/* Section description */}
      <div className="space-y-2">
        <p className="text-sm text-gray-600">
          Define metadata fields to import from CSV or JSON files. Drag to
          reorder priority. Active fields will be matched against column headers
          during import. Required fields must have a value for the import to
          succeed.
        </p>
      </div>

      {/* Meta objects list */}
      <div className="space-y-3">
        {metaObjects === undefined ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : metaObjects.length === 0 && !isCreating ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No meta fields defined yet.</p>
            <p className="text-xs mt-1">
              Add fields like "guidance", "steps", or "model" to import metadata
              with your images.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={metaObjects.map((m) => m._id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {metaObjects.map((metaObject) => (
                  <SortableMetaItem
                    key={metaObject._id}
                    metaObject={metaObject}
                    isEditing={editingId === metaObject._id}
                    editName={editName}
                    editType={editType}
                    onToggleActive={(active) =>
                      handleToggleActive(metaObject, active)
                    }
                    onToggleRequired={(required) =>
                      handleToggleRequired(metaObject, required)
                    }
                    onStartEdit={() => handleStartEdit(metaObject)}
                    onCancelEdit={handleCancelEdit}
                    onSaveEdit={handleSaveEdit}
                    onDelete={() => handleDeleteClick(metaObject)}
                    onEditNameChange={setEditName}
                    onEditTypeChange={setEditType}
                    isSaving={isSaving}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Create new field form */}
        {isCreating && (
          <div className="flex items-center gap-3 p-3 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
            <div className="p-1 text-gray-300">
              <GripVertical className="w-4 h-4" />
            </div>

            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Field name (e.g., guidance)"
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  handleCreate();
                } else if (e.key === "Escape") {
                  handleCancelCreate();
                }
              }}
            />

            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as MetaObjectType)}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            >
              <option value="string">string</option>
              <option value="number">number</option>
            </select>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onMouseDownCapture={handleCancelCreate}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                disabled={isSaving}
              >
                <X className="w-4 h-4" />
              </button>
              <button
                type="button"
                onMouseDownCapture={handleCreate}
                disabled={!newName.trim() || isSaving}
                className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-md transition-colors cursor-pointer disabled:text-gray-300 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Add button */}
        {!isCreating && (
          <button
            type="button"
            onMouseDownCapture={() => setIsCreating(true)}
            className="flex items-center gap-2 w-full p-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-dashed border-gray-300 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Meta Field
          </button>
        )}
      </div>

      {/* Delete confirmation modal */}
      <DeleteMetaObjectModal
        isOpen={deleteTarget !== null}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        metaObjectName={deleteTarget?.name ?? ""}
        imageCount={deleteTargetImageCount ?? 0}
        isLoading={deleteTarget !== null && deleteTargetImageCount === undefined}
        isDeleting={isDeleting}
      />
    </>
  );
}
