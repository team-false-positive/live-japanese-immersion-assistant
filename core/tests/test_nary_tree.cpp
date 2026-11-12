// core/tests/test_nary_tree.cpp
// Build and run from the project root:
//   g++ -std=c++17 core/tests/test_nary_tree.cpp -o test_nary_tree && ./test_nary_tree

#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>
#include "../NaryTree.h"

int failures = 0;

#define CHECK(condition, description) \
    do { \
        if (condition) { \
            std::cout << "[PASS] " << description << std::endl; \
        } else { \
            std::cout << "[FAIL] " << description << std::endl; \
            ++failures; \
        } \
    } while (0)

// Builds the sample tree used by most tests:
//        明
//       /  \
//      日   月
//     /
//    一
void buildSample(NaryTree<std::string>& tree) {
    auto* root = tree.setRoot("明");
    auto* sun = tree.insertChild(root, "日");
    tree.insertChild(root, "月");
    tree.insertChild(sun, "一");
}

void test_set_root_and_get_root() {
    NaryTree<std::string> tree;
    auto* root = tree.setRoot("明");
    CHECK(root != nullptr, "setRoot returns a node");
    CHECK(tree.getRoot() == root, "getRoot returns the root that setRoot created");
    CHECK(root->data == "明", "root holds the value it was given");
    CHECK(tree.size() == 1, "size is 1 after setting the root");
}

void test_insert_child() {
    NaryTree<std::string> tree;
    buildSample(tree);
    auto* root = tree.getRoot();
    CHECK(root->children.size() == 2, "root has two children");
    CHECK(root->children[0]->data == "日" && root->children[1]->data == "月",
          "children are kept in insertion order");
    CHECK(root->children[0]->children.size() == 1, "a child can have its own children");
    CHECK(tree.size() == 4, "size counts all four nodes");
}

void test_insert_child_null_parent_throws() {
    NaryTree<std::string> tree;
    bool threw = false;
    try {
        tree.insertChild(nullptr, "x");
    } catch (const std::invalid_argument&) {
        threw = true;
    }
    CHECK(threw, "insertChild with a null parent throws invalid_argument");
}

void test_set_root_twice_throws() {
    NaryTree<std::string> tree;
    tree.setRoot("明");
    bool threw = false;
    try {
        tree.setRoot("日");
    } catch (const std::logic_error&) {
        threw = true;
    }
    CHECK(threw, "setRoot a second time throws logic_error");
    CHECK(tree.getRoot()->data == "明", "the original root is unchanged after the error");
}

void test_search_finds_nodes_at_any_depth() {
    NaryTree<std::string> tree;
    buildSample(tree);
    auto* deep = tree.search("一");
    CHECK(deep != nullptr && deep->data == "一", "search finds a node three levels down");
    auto* top = tree.search("明");
    CHECK(top == tree.getRoot(), "search finds the root");
    auto* side = tree.search("月");
    CHECK(side != nullptr && side->data == "月", "search finds a node on the other branch");
}

void test_search_missing_value_returns_null() {
    NaryTree<std::string> tree;
    buildSample(tree);
    CHECK(tree.search("木") == nullptr, "search for a value not in the tree returns nullptr");
}

void test_search_empty_tree_returns_null() {
    NaryTree<std::string> tree;
    CHECK(tree.search("明") == nullptr, "search on an empty tree returns nullptr");
    CHECK(tree.getRoot() == nullptr, "an empty tree has no root");
}

void test_traversal_order_and_depth() {
    NaryTree<std::string> tree;
    buildSample(tree);
    std::vector<std::string> order;
    std::vector<std::size_t> depths;
    tree.traverse([&](const std::string& data, std::size_t depth) {
        order.push_back(data);
        depths.push_back(depth);
    });

    std::string joined;
    for (const auto& s : order) {
        joined += s + " ";
    }
    CHECK(order.size() == 4, "traversal visits all four nodes");
    CHECK(joined == "明 日 一 月 ", "traversal is depth-first, parent before children");
    CHECK(depths.size() == 4 && depths[0] == 0 && depths[1] == 1 && depths[2] == 2 && depths[3] == 1,
          "traversal reports the correct depth for each node");
}

void test_traversal_of_empty_tree_visits_nothing() {
    NaryTree<std::string> tree;
    int visits = 0;
    tree.traverse([&](const std::string&, std::size_t) { ++visits; });
    CHECK(visits == 0, "traversal of an empty tree visits nothing");
}

int main() {
    test_set_root_and_get_root();
    test_insert_child();
    test_insert_child_null_parent_throws();
    test_set_root_twice_throws();
    test_search_finds_nodes_at_any_depth();
    test_search_missing_value_returns_null();
    test_search_empty_tree_returns_null();
    test_traversal_order_and_depth();
    test_traversal_of_empty_tree_visits_nothing();

    std::cout << std::endl;
    if (failures == 0) {
        std::cout << "All NaryTree tests passed." << std::endl;
    } else {
        std::cout << failures << " NaryTree test(s) failed." << std::endl;
    }
    return failures == 0 ? 0 : 1;
}
