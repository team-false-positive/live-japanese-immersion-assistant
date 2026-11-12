// core/NaryTree.h
// Week 2 Module A: general (N-ary) tree.
//
// Each node can have any number of children, which suits kanji breaking
// down into radicals and sub-components.
//
// Same interface as NaryTreeStub.h (Node with data and children, search,
// getRoot), so WordGraph.h works unchanged. The tree owns every node and
// frees them when it is destroyed. Copying is not allowed, matching
// HashTable and Queue.

#ifndef NARY_TREE_H
#define NARY_TREE_H

#include <cstddef>
#include <functional>
#include <stdexcept>
#include <vector>

template <typename T>
class NaryTree {
public:
    struct Node {
        T data;
        std::vector<Node*> children;
        explicit Node(const T& value) : data(value) {}
    };

    NaryTree() : root_(nullptr) {}

    ~NaryTree() {
        clear();
    }

    NaryTree(const NaryTree&) = delete;
    NaryTree& operator=(const NaryTree&) = delete;

    // Creates the root node. Throws if the tree already has a root.
    Node* setRoot(const T& value) {
        if (root_ != nullptr) {
            throw std::logic_error("NaryTree: root already set");
        }
        root_ = newNode(value);
        return root_;
    }

    // Adds a child under parent and returns it. Throws if parent is null.
    Node* insertChild(Node* parent, const T& value) {
        if (parent == nullptr) {
            throw std::invalid_argument("NaryTree: parent is null");
        }
        Node* child = newNode(value);
        parent->children.push_back(child);
        return child;
    }

    Node* getRoot() const {
        return root_;
    }

    // Depth-first search. Returns the first node whose data equals value,
    // or nullptr if none does.
    Node* search(const T& value) const {
        return searchFrom(root_, value);
    }

    // Visits every node depth-first: a parent before its children.
    // visit receives the node's data and its depth (the root is depth 0).
    void traverse(const std::function<void(const T&, std::size_t)>& visit) const {
        traverseFrom(root_, 0, visit);
    }

    // Number of nodes in the tree.
    std::size_t size() const {
        return nodes_.size();
    }

private:
    Node* root_;
    std::vector<Node*> nodes_; // every node, so they can all be freed

    Node* newNode(const T& value) {
        Node* node = new Node(value);
        nodes_.push_back(node);
        return node;
    }

    void clear() {
        for (Node* node : nodes_) {
            delete node;
        }
        nodes_.clear();
        root_ = nullptr;
    }

    static Node* searchFrom(Node* node, const T& value) {
        if (node == nullptr) {
            return nullptr;
        }
        if (node->data == value) {
            return node;
        }
        for (Node* child : node->children) {
            if (Node* found = searchFrom(child, value)) {
                return found;
            }
        }
        return nullptr;
    }

    static void traverseFrom(Node* node, std::size_t depth,
                             const std::function<void(const T&, std::size_t)>& visit) {
        if (node == nullptr) {
            return;
        }
        visit(node->data, depth);
        for (Node* child : node->children) {
            traverseFrom(child, depth + 1, visit);
        }
    }
};

#endif // NARY_TREE_H
