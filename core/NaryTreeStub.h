// NaryTreeStub.h
//
// Minimal stand-in for Module A's NaryTree<std::string>, used ONLY so that
// WordGraph.h and its tests compile and run standalone right now. Swap this
// #include for the real "NaryTree.h" once you drop this into the shared
// repo — WordGraph.h doesn't know or care which one it's talking to, as
// long as the interface (search(), Node::data, Node::children) matches.

#ifndef NARY_TREE_STUB_H
#define NARY_TREE_STUB_H

#include <string>
#include <vector>
#include <unordered_map>

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
        for (auto* n : allNodes_) {
            delete n;
        }
    }

    // Not copyable — same reasoning as Module A: owning raw pointers means
    // a shallow copy would double-free. Delete rather than write a deep
    // copy we don't need yet.
    NaryTree(const NaryTree&) = delete;
    NaryTree& operator=(const NaryTree&) = delete;

    Node* insertRoot(const T& value) {
        if (root_ != nullptr) {
            return nullptr; // already has a root — expected/recoverable, not an exception
        }
        root_ = makeNode(value);
        return root_;
    }

    Node* insertChild(Node* parent, const T& value) {
        if (parent == nullptr) {
            return nullptr;
        }
        Node* child = makeNode(value);
        parent->children.push_back(child);
        byValue_[value].push_back(child);
        return child;
    }

    // Full-tree search by value; returns the first match found or nullptr.
    Node* search(const T& value) const {
        auto it = byValue_.find(value);
        if (it == byValue_.end() || it->second.empty()) {
            // Root itself isn't in byValue_ unless inserted via insertChild,
            // so check it explicitly.
            if (root_ != nullptr && root_->data == value) {
                return root_;
            }
            return nullptr;
        }
        return it->second.front();
    }

    Node* getRoot() const { return root_; }

private:
    Node* root_;
    std::vector<Node*> allNodes_;
    std::unordered_map<T, std::vector<Node*>> byValue_;

    Node* makeNode(const T& value) {
        Node* n = new Node(value);
        allNodes_.push_back(n);
        return n;
    }
};

#endif // NARY_TREE_STUB_H
